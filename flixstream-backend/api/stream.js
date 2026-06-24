const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    // Enable CORS so your Android app can access it without blocks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url; // Pass the movie page from Android app
    if (!targetUrl) {
        return res.status(400).json({ success: false, error: "Missing 'url' query parameter" });
    }

    try {
        // 1. Execute the View=1 handshake protocol
        const watchPageUrl = targetUrl.includes('?view=watch') ? targetUrl : `${targetUrl}?view=watch`;
        
        const response = await axios.post(watchPageUrl, 'View=1', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': targetUrl,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            timeout: 8000
        });

        // 2. Parse the HTML using Cheerio (Server-side Jsoup)
        const $ = cheerio.load(response.data);
        const iframeSrc = $('div.watch-player iframe#videoIframe').attr('src');

        if (!iframeSrc) {
            return res.status(404).json({ success: false, error: "Player iframe not found" });
        }

        // 3. Follow the iframe link to extract the direct media track
        const iframePage = await axios.get(iframeSrc, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' }
        });

        // 4. Match the raw video stream string via Regex
        const match = iframePage.data.match(/file\s*:\s*["'](https.*?\.mp4|https.*?\.m3u8)["']/);
        
        if (match) {
            return res.status(200).json({ 
                success: true, 
                streamUrl: match[1],
                isM3u8: match[1].includes('.m3u8')
            });
        }

        res.status(404).json({ success: false, error: "Streaming link pattern not found in player page source" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};