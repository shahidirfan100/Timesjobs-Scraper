import { Actor, log } from 'apify';
import { Dataset } from 'crawlee';
import { gotScraping } from 'got-scraping';
import { load as cheerioLoad } from 'cheerio';

const ACTOR_VERSION = '2025-12-14.1';
const API_BASE = 'https://tjapi.timesjobs.com';
const SEARCH_ENDPOINT = `${API_BASE}/search/api/v1/search/jobs/list`;
const DETAIL_ENDPOINT = (id) => `${API_BASE}/job-api/api/jobs/public/${id}`;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DETAIL_CONCURRENCY = 5;

const buildStartUrl = (kw, loc, exp) => {
    const u = new URL('https://www.timesjobs.com/candidate/job-search.html');
    if (kw) u.searchParams.set('txtKeywords', String(kw).trim());
    if (loc) u.searchParams.set('txtLocation', String(loc).trim());
    if (exp) {
        const [minExp, maxExp] = String(exp).split('-').map((e) => e.trim());
        if (minExp) u.searchParams.set('cboWorkExp1', minExp);
        if (maxExp) u.searchParams.set('cboWorkExp2', maxExp);
    }
    u.searchParams.set('searchType', 'personalizedSearch');
    u.searchParams.set('from', 'submit');
    return u.href;
};

const parseExperience = (experience) => {
    if (!experience) return {};
    const parts = String(experience)
        .split('-')
        .map((p) => Number(p.trim()))
        .filter((n) => Number.isFinite(n));
    if (!parts.length) return {};
    const [from, to] = parts;
    return {
        experienceFrom: Number.isFinite(from) ? from : undefined,
        experienceTo: Number.isFinite(to) ? to : undefined,
    };
};

const cleanText = (html) => {
    if (!html) return '';
    const $ = cheerioLoad(html);
    $('script, style, noscript, iframe').remove();
    return $.root().text().replace(/\s+/g, ' ').trim();
};

const skillsToArray = (skills) => {
    if (!skills) return null;
    const list = String(skills)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 80);
    return list.length ? list : null;
};

const formatSalary = (low, high, currency, flags = {}) => {
    const cur = (currency || 'INR').toUpperCase();
    if (flags.bestInIndustry) return 'Best in the industry';
    if (flags.hideCtc) return 'As per industry standard';
    const toLpa = (val) => `${(val / 100000).toFixed(2)} ${cur === 'INR' ? 'LPA' : cur}`;
    if (low && high) return `${toLpa(low)} - ${toLpa(high)}`;
    if (low) return toLpa(low);
    if (high) return toLpa(high);
    return null;
};

const chunk = (arr, size) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
};

const deriveSearchFromUrls = (urls) => {
    const derived = {};
    for (const raw of urls || []) {
        try {
            const u = new URL(raw);
            const qp = u.searchParams;

            const kw = qp.get('keywords') || qp.get('txtKeywords');
            const loc = qp.get('location') || qp.get('txtLocation');
            const fa = qp.get('functionAreaId') || qp.get('cboPresFuncArea');
            const exp = qp.get('experience');
            const expFrom = qp.get('experienceFrom') || qp.get('cboWorkExp1');
            const expTo = qp.get('experienceTo') || qp.get('cboWorkExp2');

            if (kw && !derived.keyword) derived.keyword = kw;
            if (loc && !derived.location) derived.location = loc;
            if (fa && !derived.functionAreaId) derived.functionAreaId = fa;
            if (exp && !derived.experience) derived.experience = exp;
            if (expFrom && !derived.experienceFrom) derived.experienceFrom = Number(expFrom);
            if (expTo && !derived.experienceTo) derived.experienceTo = Number(expTo);
        } catch (_) {
            // ignore invalid urls
        }
    }
    return derived;
};

await Actor.main(async () => {
    const input = (await Actor.getInput()) || {};
    const {
        keyword = '',
        location = '',
        experience = '',
        functionAreaId: FUNCTION_AREA_ID_INPUT,
        results_wanted: RESULTS_WANTED_RAW = 100,
        max_pages: MAX_PAGES_RAW = 10,
        collectDetails = true,
        startUrl,
        startUrls,
        url,
        proxyConfiguration,
    } = input;

    const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) ? Math.max(1, +RESULTS_WANTED_RAW) : Number.MAX_SAFE_INTEGER;
    const MAX_PAGES = Number.isFinite(+MAX_PAGES_RAW) ? Math.max(1, +MAX_PAGES_RAW) : 10;

    const proxyConf = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : null;
    const proxyUrl = proxyConf ? await proxyConf.newUrl() : undefined;

    const fetchHtml = async (targetUrl) => {
        const attempt = async (useProxy) => gotScraping({
            url: targetUrl,
            proxyUrl: useProxy ? proxyUrl : undefined,
            timeout: { request: 30000 },
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                referer: 'https://www.timesjobs.com/job-search',
            },
        });

        try {
            return await attempt(Boolean(proxyUrl));
        } catch (err) {
            const status = err?.response?.statusCode || err?.statusCode;
            const msg = err?.message || '';
            const proxyRelated = /UPSTREAM|proxy/i.test(msg);
            const serverError = status && status >= 500 && status < 600;
            if (proxyUrl && (proxyRelated || serverError)) {
                log.warning(`HTML fetch via proxy failed (${msg || status}), retrying without proxy...`);
                return attempt(false);
            }
            throw err;
        }
    };

    const initialUrls = [];
    if (Array.isArray(startUrls) && startUrls.length) initialUrls.push(...startUrls);
    if (startUrl) initialUrls.push(startUrl);
    if (url) initialUrls.push(url);
    if (!initialUrls.length) initialUrls.push(buildStartUrl(keyword, location, experience));

    const derived = deriveSearchFromUrls(initialUrls);
    const effectiveKeyword = keyword || derived.keyword || '';
    const effectiveLocation = location || derived.location || '';
    const effectiveFunctionAreaId = FUNCTION_AREA_ID_INPUT || derived.functionAreaId || undefined;
    const effectiveExperience = experience || derived.experience || '';

    log.info(`Actor version: ${ACTOR_VERSION}`);

    const seen = new Set();
    let saved = 0;

    const expRangeFromInput = parseExperience(effectiveExperience);
    const expRangeFromUrl = {
        experienceFrom: Number.isFinite(derived.experienceFrom) ? derived.experienceFrom : undefined,
        experienceTo: Number.isFinite(derived.experienceTo) ? derived.experienceTo : undefined,
    };
    const expRange = {
        experienceFrom: expRangeFromInput.experienceFrom ?? expRangeFromUrl.experienceFrom,
        experienceTo: expRangeFromInput.experienceTo ?? expRangeFromUrl.experienceTo,
    };

    async function fetchJson(opts, { allowDirectFallback = true } = {}) {
        const parseJsonResponse = (res) => {
            const contentType = String(res?.headers?.['content-type'] || '');
            const body = res?.body;
            if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
            const text = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body ?? '');
            try {
                return JSON.parse(text);
            } catch (err) {
                const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 250);
                throw new Error(`Expected JSON but got ${contentType || 'unknown content-type'}: ${snippet}`);
            }
        };

        const attempt = async (useProxy) => {
            const res = await gotScraping({
                proxyUrl: useProxy ? proxyUrl : undefined,
                timeout: { request: 30000 },
                retry: { limit: 2, statusCodes: [408, 429, 500, 502, 503, 504] },
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    accept: 'application/json, text/plain, */*',
                    referer: 'https://www.timesjobs.com/job-search',
                    origin: 'https://www.timesjobs.com',
                    ...opts.headers,
                },
                ...opts,
            });
            return parseJsonResponse(res);
        };

        try {
            return await attempt(Boolean(proxyUrl));
        } catch (err) {
            const status = err?.response?.statusCode || err?.statusCode;
            const msg = err?.message || '';
            const proxyRelated = /UPSTREAM|proxy/i.test(msg);
            const serverError = status && status >= 500 && status < 600;
            if (proxyUrl && allowDirectFallback && (proxyRelated || serverError)) {
                log.warning(`Proxy call failed (${msg || status}), retrying without proxy...`);
                return attempt(false);
            }
            throw err;
        }
    }

    async function fetchDetail(jobId, jobDetailUrl) {
        try {
            if (jobId) {
                const detail = await fetchJson({ url: DETAIL_ENDPOINT(jobId), responseType: 'json', method: 'GET' });
                return detail || {};
            }
        } catch (err) {
            log.debug(`Detail API failed for ${jobId}: ${err.message}`);
        }

        if (!jobDetailUrl) return {};

        try {
            const res = await fetchHtml(jobDetailUrl);
            const $ = cheerioLoad(res.body);
            const ld = $('script[type="application/ld+json"]').map((_, el) => {
                try {
                    return JSON.parse($(el).text());
                } catch (_) {
                    return null;
                }
            }).get().find((data) => data && data['@type'] === 'JobPosting');
            const description_html = ld?.description || $('.jd-desc, .job-description, [class*="job-desc"]').first().html() || null;
            return {
                description: description_html,
                title: ld?.title,
                company: ld?.hiringOrganization?.name,
                location: ld?.jobLocation?.address?.addressLocality,
                postDate: ld?.datePosted,
            };
        } catch (fallbackErr) {
            log.debug(`HTML detail fallback failed for ${jobDetailUrl || jobId}: ${fallbackErr.message}`);
            return {};
        }
    }

    async function fetchApiPage(page, pageSize) {
        const payload = {
            keywords: effectiveKeyword || undefined,
            location: effectiveLocation || undefined,
            page: String(page),
            size: String(pageSize),
            company: '',
            industry: '',
            functionAreaId: effectiveFunctionAreaId ? String(effectiveFunctionAreaId) : undefined,
            ...expRange,
        };
        log.debug(`API search page ${page} payload: ${JSON.stringify(payload)}`);
        return fetchJson({
            url: SEARCH_ENDPOINT,
            method: 'POST',
            json: payload,
            responseType: 'json',
        });
    }

    async function runApiFlow() {
        let page = 1;
        while (saved < RESULTS_WANTED && page <= MAX_PAGES) {
            const remaining = RESULTS_WANTED - saved;
            const pageSize = Math.min(Math.max(1, remaining), MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
            let data;
            try {
                data = await fetchApiPage(page, pageSize);
            } catch (err) {
                log.warning(`API search failed on page ${page}: ${err.message}`);
                break;
            }

            const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
            log.info(`API page ${page}: received ${jobs.length} jobs`);
            if (!jobs.length) break;

            const toEnrich = jobs.filter((job) => {
                const uniqueId = job.jobId || job.jobDetailUrl || job.title;
                if (!uniqueId || seen.has(uniqueId)) return false;
                seen.add(uniqueId);
                return true;
            });

            if (!toEnrich.length) break;

            for (const batch of chunk(toEnrich, DETAIL_CONCURRENCY)) {
                const detailed = await Promise.all(
                    batch.map(async (job) => {
                        const detail = collectDetails ? await fetchDetail(job.jobId, job.jobDetailUrl) : {};
                        const description_html = detail.description || job.description || null;
                        const description_text = description_html ? cleanText(description_html) : null;
                        const skills = skillsToArray(job.skills || detail.skills);
                        const salary = formatSalary(
                            detail.lowSalary ?? job.lowSalary,
                            detail.highSalary ?? job.highSalary,
                            detail.currency ?? job.currency,
                            {
                                bestInIndustry: detail.isBestInIndustry ?? job.isBestInIndustry,
                                hideCtc: detail.hideCtcFromCandidate ?? job.hideCtcFromCandidate,
                            },
                        );

                        const item = {
                            title: detail.title || job.title || null,
                            company: detail.company || detail.companyName || job.company || job.hfCompany || null,
                            experience: job.experienceFrom || job.experienceTo
                                ? `${job.experienceFrom ?? '?'} - ${job.experienceTo ?? '?'} Yrs`
                                : null,
                            location: detail.location || job.location || null,
                            skills,
                            salary: salary || null,
                            job_type: detail.jobType || job.jobType || null,
                            date_posted: detail.postDate || job.postDate || null,
                            description_html: description_html || null,
                            description_text: description_text || null,
                            url: job.jobDetailUrl || (detail.jobId ? `https://www.timesjobs.com/job-detail/${detail.jobId}` : null),
                            job_id: job.jobId || detail.jobId || null,
                            source: 'api',
                        };

                        return item;
                    }),
                );

                const remainingAfterBatch = RESULTS_WANTED - saved;
                const toPush = detailed.slice(0, Math.max(0, remainingAfterBatch));
                if (toPush.length) {
                    await Dataset.pushData(toPush);
                    saved += toPush.length;
                    log.info(`Saved ${saved}/${RESULTS_WANTED} jobs (API)`);
                }
                if (saved >= RESULTS_WANTED) break;
            }

            const total = Number(data?.total) || 0;
            const totalPages = total && data?.size ? Math.ceil(total / data.size) : null;
            if (totalPages && page >= totalPages) break;
            page += 1;
        }
    }

    async function runHtmlFallback() {
        for (const start of initialUrls) {
            if (saved >= RESULTS_WANTED) break;
            try {
                const res = await fetchHtml(start);
                const $ = cheerioLoad(res.body);
                const jobLinks = [];
                $('a[href*="jobid"], a[href*="job-detail"], a[href*="jobid="]').each((_, el) => {
                    const href = $(el).attr('href');
                    if (!href) return;
                    try {
                        const full = new URL(href, 'https://www.timesjobs.com').href;
                        jobLinks.push(full);
                    } catch (_) {
                        // ignore bad urls
                    }
                });
                const uniqueLinks = Array.from(new Set(jobLinks));
                log.info(`HTML fallback: found ${uniqueLinks.length} potential job links from ${start}`);
                for (const link of uniqueLinks) {
                    if (saved >= RESULTS_WANTED) break;
                    if (seen.has(link)) continue;
                    seen.add(link);
                    const detail = await fetchDetail(null, link);
                    const description_html = detail.description || null;
                    const description_text = description_html ? cleanText(description_html) : null;
                    const item = {
                        title: detail.title || null,
                        company: detail.company || null,
                        experience: detail.experience || null,
                        location: detail.location || null,
                        skills: skillsToArray(detail.skills),
                        salary: formatSalary(detail.lowSalary, detail.highSalary, detail.currency, {
                            bestInIndustry: detail.isBestInIndustry,
                            hideCtc: detail.hideCtcFromCandidate,
                        }),
                        job_type: detail.jobType || null,
                        date_posted: detail.postDate || null,
                        description_html,
                        description_text,
                        url: link,
                        source: 'html-fallback',
                    };
                    await Dataset.pushData(item);
                    saved += 1;
                    log.info(`Saved ${saved}/${RESULTS_WANTED} jobs (HTML fallback)`);
                }
            } catch (err) {
                log.warning(`HTML fallback failed for ${start}: ${err.message}`);
            }
        }
    }

    await runApiFlow();
    if (saved === 0) {
        log.warning('API returned no items, switching to HTML fallback.');
        await runHtmlFallback();
    }

    log.info(`Scraping completed. Total jobs saved: ${saved}`);
});
