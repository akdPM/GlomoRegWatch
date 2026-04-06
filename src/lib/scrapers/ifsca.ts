import * as cheerio from 'cheerio';
import { getSeededDocuments } from '../seeds';
import { fetchPdfText, resolveDirectPdfUrl } from '../pdf';

export const scrapeIFSCA = async (): Promise<any[]> => {
    try {
        const response = await fetch('https://ifsca.gov.in/Legal/Index/wF6kttc1JR8=', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GlomoRegWatch/1.0'
            }
        });
        
        if (!response.ok) {
            console.error(`IFSCA Fetch failed: ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const items: any[] = [];
        
        $('table tbody tr, table tr').each((i, el) => {
            if (i === 0 || items.length >= 15) return;
            
            const titleTd = $(el).find('td').eq(1);
            let title = titleTd.text().trim();
            let linkTag = $(el).find('a').first().attr('href');
            
            if (!title) title = $(el).text().replace(/\s\s+/g, ' ').substring(0, 150).trim();

            if (title && linkTag) {
                const pdf_url = linkTag.startsWith('http') ? linkTag : `https://ifsca.gov.in${linkTag.startsWith('/') ? '' : '/'}${linkTag}`;
                items.push({
                    source: 'IFSCA',
                    title: title,
                    source_url: pdf_url, 
                    pdf_url: pdf_url,
                    published_at: new Date().toISOString(),
                    raw_text: title,
                    status: 'fetched'
                });
            }
        });

        // Use seeded documents list as authoritative source since IFSCA uses client-side ASP.NET grid
        const seeds = getSeededDocuments().filter(d => d.source === 'IFSCA');
        const sourceList = items.length > 0 ? items : seeds.map(d => ({
            source: 'IFSCA',
            title: d.title,
            source_url: d.pdf_url,
            pdf_url: d.pdf_url,
            published_at: d.published_at,
            raw_text: (d as any).raw_content || d.title,
            status: 'fetched'
        }));

        if (items.length === 0) {
            console.log('IFSCA DOM extraction yielded 0 items. Using seeded authoritative circular list with live PDF extraction.');
        }

        // Attempt live PDF extraction for each document
        const enriched = await Promise.all(sourceList.map(async (doc) => {
            // Resolve the direct PDF download URL (GetFileView → ViewFile)
            const directPdfUrl = resolveDirectPdfUrl(doc.pdf_url);
            const pdfText = await fetchPdfText(directPdfUrl);
            return {
                ...doc,
                raw_text: pdfText || doc.raw_text,
            };
        }));

        return enriched;
    } catch (err) {
        console.error('IFSCA Scraper failed', err);
        return getSeededDocuments().filter(d => d.source === 'IFSCA').map(d => ({
            ...d,
            source_url: d.pdf_url,
            raw_text: (d as any).raw_content || d.title,
            status: 'fetched'
        }));
    }
};
