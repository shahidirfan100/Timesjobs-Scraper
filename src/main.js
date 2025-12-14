// Timesjobs scraper - CheerioCrawler implementation
import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';
import { load as cheerioLoad } from 'cheerio';

await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            keyword = '',
            location = '',
            experience = '',
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

        const cleanText = (html) => {
            if (!html) return '';
            const $ = cheerioLoad(html);
            $('script, style, noscript, iframe').remove();
            return $.root().text().replace(/\s+/g, ' ').trim();
        };

        const buildStartUrl = (kw, loc, exp) => {
            const u = new URL('https://www.timesjobs.com/candidate/job-search.html');
            if (kw) u.searchParams.set('searchType', 'personalizedSearch');
            if (kw) u.searchParams.set('from', 'submit');
            if (kw) u.searchParams.set('txtKeywords', String(kw).trim());
            if (loc) u.searchParams.set('txtLocation', String(loc).trim());
            if (exp) {
                const [minExp, maxExp] = String(exp).split('-').map(e => e.trim());
                if (minExp) u.searchParams.set('cboWorkExp1', minExp);
                if (maxExp) u.searchParams.set('cboWorkExp2', maxExp);
            }
            return u.href;
        };

        const initial = [];
        if (Array.isArray(startUrls) && startUrls.length) initial.push(...startUrls);
        if (startUrl) initial.push(startUrl);
        if (url) initial.push(url);
        if (!initial.length) initial.push(buildStartUrl(keyword, location, experience));

        const proxyConf = proxyConfiguration ? await Actor.createProxyConfiguration({ ...proxyConfiguration }) : undefined;

        let saved = 0;
        const seenUrls = new Set();

        function extractJobsFromHTML($) {
            const jobs = [];
            
            $('li[class*="clearfix job-bx"]').each((_, elem) => {
                try {
                    const $job = $(elem);
                    
                    const titleElem = $job.find('h2 a, h3 a, .job-title a, header h2 a').first();
                    const title = titleElem.text().trim() || null;
                    const jobUrl = titleElem.attr('href') ? new URL(titleElem.attr('href'), 'https://www.timesjobs.com').href : null;
                    
                    const company = $job.find('h3.joblist-comp-name, .comp-name, [class*="comp-name"]').first().text().trim() || null;
                    
                    let experience = null;
                    $job.find('ul li').each((_, li) => {
                        const text = $(li).text();
                        if (/experience|exp|yrs/i.test(text)) {
                            experience = text.replace(/card_travel|icons/gi, '').trim();
                        }
                    });
                    
                    let location = null;
                    $job.find('ul li').each((_, li) => {
                        const text = $(li).text();
                        if (/location|place/i.test(text) || $(li).find('[class*="location"]').length) {
                            location = text.replace(/location_on|icons/gi, '').trim();
                        }
                    });
                    
                    const skills = [];
                    $job.find('.srp-skills, [class*="skills"]').find('span, a').each((_, s) => {
                        const skill = $(s).text().trim();
                        if (skill && skill.length > 1 && skill.length < 50) {
                            skills.push(skill);
                        }
                    });
                    
                    let datePosted = null;
                    $job.find('.sim-posted span, [class*="posted"] span').each((_, span) => {
                        const text = $(span).text().trim();
                        if (/posted|ago|days|hours/i.test(text)) {
                            datePosted = text;
                        }
                    });
                    
                    let description = null;
                    const descElem = $job.find('.list-job-dtl, .job-description, [class*="description"]').first();
                    if (descElem.length) {
                        description = descElem.text().trim().substring(0, 500);
                    }
                    
                    if (jobUrl && !seenUrls.has(jobUrl)) {
                        seenUrls.add(jobUrl);
                        jobs.push({
                            title,
                            company,
                            experience,
                            location,
                            skills: skills.length > 0 ? skills : null,
                            date_posted: datePosted,
                            description_preview: description,
                            url: jobUrl,
                        });
                    }
                } catch (err) {
                    log.debug(`Error parsing job: ${err.message}`);
                }
            });
            
            return jobs;
        }

        function findNextPage($, currentPageNum) {
            const nextPageNum = currentPageNum + 1;
            
            const nextLink = $(`a:contains("${nextPageNum}")`).first().attr('href');
            if (nextLink) {
                return new URL(nextLink, 'https://www.timesjobs.com').href;
            }
            
            const paginationLinks = $('a[href*="sequence="]');
            for (let i = 0; i < paginationLinks.length; i++) {
                const href = $(paginationLinks[i]).attr('href');
                if (href && href.includes(`sequence=${nextPageNum}`)) {
                    return new URL(href, 'https://www.timesjobs.com').href;
                }
            }
            
            return null;
        }

        const crawler = new CheerioCrawler({
            proxyConfiguration: proxyConf,
            maxRequestRetries: 3,
            useSessionPool: true,
            maxConcurrency: 5,
            requestHandlerTimeoutSecs: 90,
            async requestHandler({ request, $, enqueueLinks, log: crawlerLog }) {
                const label = request.userData?.label || 'LIST';
                const pageNo = request.userData?.pageNo || 1;

                if (label === 'LIST') {
                    const jobs = extractJobsFromHTML($);
                    crawlerLog.info(`Page ${pageNo}: Found ${jobs.length} jobs`);

                    if (collectDetails) {
                        const remaining = RESULTS_WANTED - saved;
                        const toEnqueue = jobs.slice(0, Math.max(0, remaining));
                        
                        for (const job of toEnqueue) {
                            if (job.url) {
                                await enqueueLinks({ 
                                    urls: [job.url], 
                                    userData: { 
                                        label: 'DETAIL',
                                        baseData: job
                                    } 
                                });
                            }
                        }
                    } else {
                        const remaining = RESULTS_WANTED - saved;
                        const toPush = jobs.slice(0, Math.max(0, remaining));
                        if (toPush.length) {
                            await Dataset.pushData(toPush);
                            saved += toPush.length;
                        }
                    }

                    if (saved < RESULTS_WANTED && pageNo < MAX_PAGES) {
                        const nextUrl = findNextPage($, pageNo);
                        if (nextUrl) {
                            await enqueueLinks({ 
                                urls: [nextUrl], 
                                userData: { label: 'LIST', pageNo: pageNo + 1 } 
                            });
                        }
                    }
                    return;
                }

                if (label === 'DETAIL') {
                    if (saved >= RESULTS_WANTED) return;
                    
                    try {
                        const baseData = request.userData?.baseData || {};
                        
                        const title = $('h1, .jd-header-title, [class*="job-title"]').first().text().trim() || baseData.title;
                        const company = $('.jd-header-comp-name, [class*="company-name"]').first().text().trim() || baseData.company;
                        
                        const descElem = $('.jd-desc, .job-description, [class*="job-desc"]').first();
                        const descriptionHtml = descElem && descElem.length ? descElem.html() : null;
                        const descriptionText = descriptionHtml ? cleanText(descriptionHtml) : null;
                        
                        let salary = null;
                        $('[class*="salary"], [class*="compensation"]').each((_, elem) => {
                            const text = $(elem).text().trim();
                            if (text && /lakh|lakhs|₹|rs/i.test(text)) {
                                salary = text;
                            }
                        });
                        
                        let jobType = null;
                        $('[class*="job-type"], [class*="employment"]').each((_, elem) => {
                            const text = $(elem).text().trim();
                            if (text && /full|part|contract|permanent/i.test(text)) {
                                jobType = text;
                            }
                        });
                        
                        const item = {
                            title: title || null,
                            company: company || null,
                            experience: baseData.experience || null,
                            location: baseData.location || null,
                            skills: baseData.skills || null,
                            salary: salary || null,
                            job_type: jobType || null,
                            date_posted: baseData.date_posted || null,
                            description_html: descriptionHtml || null,
                            description_text: descriptionText || null,
                            url: request.url,
                        };

                        await Dataset.pushData(item);
                        saved++;
                        crawlerLog.info(`Saved job ${saved}/${RESULTS_WANTED}: ${item.title}`);
                    } catch (err) {
                        crawlerLog.error(`Failed to parse detail page ${request.url}: ${err.message}`);
                    }
                }
            },
        });

        await crawler.run(initial.map(u => ({ url: u, userData: { label: 'LIST', pageNo: 1 } })));
        log.info(`✓ Scraping completed. Total jobs saved: ${saved}`);
    } finally {
        await Actor.exit();
    }
}

main().catch(err => {
    log.error(`Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
});
