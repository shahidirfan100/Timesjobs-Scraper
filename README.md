# Timesjobs Scraper

<p align="center">
  <strong>Extract job listings from Timesjobs.com efficiently and reliably</strong>
</p>

<p align="center">
  <em>A high-performance job scraper designed for recruiters, job seekers, and data analysts</em>
</p>

---

## 📋 Overview

The **Timesjobs Scraper** is a powerful automation tool that extracts job listings from [Timesjobs.com](https://www.timesjobs.com/), one of India's leading job portals. This scraper enables you to collect comprehensive job data including titles, company names, locations, required skills, experience requirements, salary ranges, and full job descriptions.

### Why Use This Scraper?

- **Fast & Efficient**: Quickly extract hundreds of job listings in minutes
- **Comprehensive Data**: Get detailed information including skills, experience, salary, and full descriptions
- **Flexible Filtering**: Search by keyword, location, and experience level
- **Reliable Extraction**: Built with robust parsing logic to handle various page structures
- **Structured Output**: Receive data in clean, structured JSON format ready for analysis

---

## 🚀 Features

<table>
  <tr>
    <td><strong>✨ Advanced Filtering</strong></td>
    <td>Filter jobs by keyword, location, and experience range</td>
  </tr>
  <tr>
    <td><strong>📊 Detailed Information</strong></td>
    <td>Extract job titles, companies, skills, salary, descriptions, and more</td>
  </tr>
  <tr>
    <td><strong>🔄 Pagination Support</strong></td>
    <td>Automatically navigate through multiple pages of search results</td>
  </tr>
  <tr>
    <td><strong>💾 Structured Data</strong></td>
    <td>Export data in JSON, CSV, Excel, or other formats</td>
  </tr>
  <tr>
    <td><strong>⚡ High Performance</strong></td>
    <td>Optimized for speed with concurrent request handling</td>
  </tr>
  <tr>
    <td><strong>🛡️ Proxy Support</strong></td>
    <td>Built-in proxy rotation to ensure reliable scraping</td>
  </tr>
</table>

---

## 💡 Use Cases

### For Recruiters & HR Professionals
- Build comprehensive talent databases
- Monitor competitor job postings
- Analyze market salary trends
- Track skill demand across industries

### For Job Seekers
- Aggregate job listings matching your criteria
- Monitor new opportunities in your field
- Compare job requirements across companies
- Track salary ranges for specific roles

### For Data Analysts & Researchers
- Conduct labor market research
- Analyze hiring trends and patterns
- Study skill requirements across industries
- Generate employment market reports

---

## 📥 Input Configuration

Configure the scraper using these parameters:

<table>
  <thead>
    <tr>
      <th>Parameter</th>
      <th>Type</th>
      <th>Description</th>
      <th>Example</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>keyword</code></td>
      <td>String</td>
      <td>Job title or skills to search for</td>
      <td>"software developer"</td>
    </tr>
    <tr>
      <td><code>location</code></td>
      <td>String</td>
      <td>City or region to filter jobs</td>
      <td>"Bengaluru"</td>
    </tr>
    <tr>
      <td><code>experience</code></td>
      <td>String</td>
      <td>Experience range in years (format: "min-max")</td>
      <td>"0-5"</td>
    </tr>
    <tr>
      <td><code>results_wanted</code></td>
      <td>Integer</td>
      <td>Maximum number of jobs to extract</td>
      <td>100</td>
    </tr>
    <tr>
      <td><code>max_pages</code></td>
      <td>Integer</td>
      <td>Maximum pages to scrape (safety limit)</td>
      <td>10</td>
    </tr>
    <tr>
      <td><code>collectDetails</code></td>
      <td>Boolean</td>
      <td>Visit job detail pages for full descriptions</td>
      <td>true</td>
    </tr>
    <tr>
      <td><code>startUrl</code></td>
      <td>String</td>
      <td>Custom Timesjobs search URL (optional)</td>
      <td>"https://www.timesjobs.com/..."</td>
    </tr>
    <tr>
      <td><code>proxyConfiguration</code></td>
      <td>Object</td>
      <td>Proxy settings for reliable scraping</td>
      <td>See Apify Proxy docs</td>
    </tr>
  </tbody>
</table>

### Example Input

```json
{
  "keyword": "python developer",
  "location": "Bengaluru",
  "experience": "2-5",
  "results_wanted": 100,
  "max_pages": 10,
  "collectDetails": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

---

## 📤 Output Format

The scraper returns structured data for each job listing:

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>title</code></td>
      <td>String</td>
      <td>Job title or position name</td>
    </tr>
    <tr>
      <td><code>company</code></td>
      <td>String</td>
      <td>Hiring company or organization name</td>
    </tr>
    <tr>
      <td><code>experience</code></td>
      <td>String</td>
      <td>Required years of experience</td>
    </tr>
    <tr>
      <td><code>location</code></td>
      <td>String</td>
      <td>Job location (city/cities)</td>
    </tr>
    <tr>
      <td><code>skills</code></td>
      <td>Array</td>
      <td>List of required skills and technologies</td>
    </tr>
    <tr>
      <td><code>salary</code></td>
      <td>String</td>
      <td>Salary range or compensation details</td>
    </tr>
    <tr>
      <td><code>job_type</code></td>
      <td>String</td>
      <td>Employment type (Full-time, Contract, etc.)</td>
    </tr>
    <tr>
      <td><code>date_posted</code></td>
      <td>String</td>
      <td>When the job was posted</td>
    </tr>
    <tr>
      <td><code>description_html</code></td>
      <td>String</td>
      <td>Full job description (HTML format)</td>
    </tr>
    <tr>
      <td><code>description_text</code></td>
      <td>String</td>
      <td>Full job description (plain text)</td>
    </tr>
    <tr>
      <td><code>url</code></td>
      <td>String</td>
      <td>Direct link to the job listing</td>
    </tr>
  </tbody>
</table>

### Example Output

```json
{
  "title": "Senior Python Developer",
  "company": "Tech Solutions Pvt Ltd",
  "experience": "3 - 5 Yrs",
  "location": "Bengaluru, Pune, Mumbai",
  "skills": ["Python", "Django", "REST API", "PostgreSQL", "AWS"],
  "salary": "8 - 12 Lakhs",
  "job_type": "Full Time",
  "date_posted": "Posted 2 days ago",
  "description_html": "<p>We are looking for...</p>",
  "description_text": "We are looking for an experienced Python developer...",
  "url": "https://www.timesjobs.com/job-detail/..."
}
```

---

## 🎯 How to Use

### Option 1: Using the Apify Platform

1. **Navigate** to the Timesjobs Scraper on Apify
2. **Configure** your search parameters in the input form
3. **Click** "Start" to begin scraping
4. **Download** your data in JSON, CSV, Excel, or other formats

### Option 2: Using Apify API

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: 'YOUR_API_TOKEN',
});

const input = {
    keyword: "software developer",
    location: "Bengaluru",
    experience: "2-5",
    results_wanted: 100,
    collectDetails: true
};

const run = await client.actor("YOUR_ACTOR_ID").call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log(items);
```

### Option 3: Using Apify CLI

```bash
apify call YOUR_ACTOR_ID --input '{
  "keyword": "data scientist",
  "location": "Mumbai",
  "results_wanted": 50
}'
```

---

## ⚙️ Configuration Tips

### Optimizing Performance

- **results_wanted**: Set a reasonable limit (50-200) for faster runs
- **max_pages**: Use this as a safety limit to prevent excessive scraping
- **collectDetails**: Disable if you only need basic job information
- **proxyConfiguration**: Always use proxies for reliable, uninterrupted scraping

### Best Practices

- Start with a small number of results to test your configuration
- Use specific keywords for more relevant results
- Combine keyword and location filters for targeted searches
- Enable `collectDetails` only when you need full job descriptions
- Use Apify Proxy to avoid rate limiting and IP blocks

---

## 📊 Data Export Options

Export your scraped data in multiple formats:

- **JSON** - Perfect for programmatic processing
- **CSV** - Ideal for Excel and data analysis tools
- **Excel** - Ready for immediate analysis and reporting
- **HTML Table** - Quick viewing in web browsers
- **RSS Feed** - For automated monitoring

---

## 🔧 Technical Details

### Architecture

The scraper is built using modern web scraping best practices:

- **Efficient HTML Parsing**: Extracts data directly from HTML structure
- **Pagination Handling**: Automatically navigates through result pages
- **Error Recovery**: Built-in retry logic for failed requests
- **Data Validation**: Ensures output data quality and consistency
- **Proxy Rotation**: Supports proxy configuration for reliable scraping

### Performance

- **Speed**: Scrapes 50-100 jobs per minute (depending on configuration)
- **Concurrency**: Handles multiple requests simultaneously
- **Memory**: Optimized for efficient memory usage
- **Reliability**: Built-in error handling and retry mechanisms

---

## ❓ Frequently Asked Questions

### How many jobs can I scrape?

You can scrape as many jobs as needed. However, we recommend setting reasonable limits (100-500 jobs per run) for optimal performance.

### Does this scraper require proxies?

While not mandatory, using proxies (especially Apify Proxy) is highly recommended for reliable, uninterrupted scraping.

### How fresh is the data?

The scraper fetches real-time data directly from Timesjobs.com, ensuring you get the most current job listings.

### Can I schedule regular scraping?

Yes! Use Apify's scheduling feature to run the scraper daily, weekly, or at custom intervals.

### What if the scraper stops working?

The scraper is regularly maintained and updated. If you encounter issues, please report them through Apify support.

---

## 📞 Support & Feedback

Need help or have suggestions?

- **Issues**: Report bugs or request features
- **Questions**: Contact through Apify platform
- **Updates**: The scraper is regularly maintained to ensure compatibility

---

## 🔒 Legal & Ethics

This scraper is provided for legitimate use cases such as:
- Job market research
- Recruitment and talent acquisition
- Academic research
- Personal job hunting

**Important**: Always comply with:
- Timesjobs.com Terms of Service
- Applicable data protection laws (GDPR, etc.)
- Ethical web scraping practices
- Rate limiting and respectful scraping

---

## 🌟 Why Choose This Scraper?

<table>
  <tr>
    <td><strong>✅ Reliable</strong></td>
    <td>Tested and maintained regularly</td>
  </tr>
  <tr>
    <td><strong>✅ Fast</strong></td>
    <td>Optimized for high-performance extraction</td>
  </tr>
  <tr>
    <td><strong>✅ Easy to Use</strong></td>
    <td>Simple configuration, no coding required</td>
  </tr>
  <tr>
    <td><strong>✅ Comprehensive</strong></td>
    <td>Extracts all relevant job information</td>
  </tr>
  <tr>
    <td><strong>✅ Flexible</strong></td>
    <td>Customizable for various use cases</td>
  </tr>
</table>

---

## 🚦 Getting Started

Ready to start scraping Timesjobs?

1. **Try it now** on the Apify platform
2. Configure your search criteria
3. Start extracting job data in minutes

<p align="center">
  <strong>Start scraping Timesjobs today and unlock valuable job market insights!</strong>
</p>

---

<p align="center">
  <sub>Built with ❤️ for the recruitment and job search community</sub>
</p>
