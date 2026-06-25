const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    // Enable Global CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url; 
    
    // Fallback message so you can easily verify it's working in your browser!
    if (!targetUrl) {
        return res.status(200).json({ 
            success: false, 
            message: "FlixStream Backend Engine is fully operational! Send a URL query parameter to test it out." 
        });
    }

    try {
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

        const $ = cheerio.load(response.data);
        const iframeSrc = $('div.watch-player iframe#videoIframe').attr('src');

        if (!iframeSrc) {
            return res.status(404).json({ success: false, error: "Player iframe container element not found" });
        }

        const iframePage = await axios.get(iframeSrc, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' }
        });

        const match = iframePage.data.match(/file\s*:\s*["'](https.*?\.mp4|https.*?\.m3u8)["']/);
        
        if (match) {
            return res.status(200).json({ 
                success: true, 
                streamUrl: match[1]
            });
        }

        res.status(404).json({ success: false, error: "Streaming track expression pattern match failed" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
