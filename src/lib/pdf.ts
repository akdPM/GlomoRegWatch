import { extractText } from 'unpdf';

/**
 * Fetches a PDF from the given URL and extracts the raw text content.
 * Works for both RBI and IFSCA PDF endpoints.
 * Returns null if the fetch fails or the content-type is not a PDF.
 */
export async function fetchPdfText(pdfUrl: string): Promise<string | null> {
    try {
        console.log(`Fetching PDF from: ${pdfUrl}`);
        const resp = await fetch(pdfUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,*/*;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': pdfUrl.includes('rbi.org.in') ? 'https://www.rbi.org.in/' : 'https://ifsca.gov.in/',
                'Cache-Control': 'no-cache',
            },
            redirect: 'follow',
        });

        if (!resp.ok) {
            console.warn(`PDF fetch failed with status ${resp.status} for: ${pdfUrl}`);
            return null;
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('pdf')) {
            console.warn(`Non-PDF content returned (${contentType}) from: ${pdfUrl}`);
            return null;
        }

        const buffer = await resp.arrayBuffer();
        const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
        const result = text?.trim() || '';
        console.log(`Extracted ${result.length} chars from PDF: ${pdfUrl}`);
        return result.length > 0 ? result : null;
    } catch (err: any) {
        console.warn(`PDF extraction error for ${pdfUrl}: ${err.message}`);
        return null;
    }
}

/**
 * For IFSCA, the GetFileView URL wraps the actual PDF in an HTML page.
 * The actual PDF binary is served via /CommonDirect/ViewFile?id=...
 * This function rewrites the URL if needed.
 */
export function resolveDirectPdfUrl(url: string): string {
    return url.replace('/CommonDirect/GetFileView', '/CommonDirect/ViewFile');
}
