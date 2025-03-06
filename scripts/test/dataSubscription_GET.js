const fs = require('fs');
const axios = require('axios');
const https = require('https');

// Read and format the certificate
const cert = fs.readFileSync('client.crt', 'utf8')
    .replace(/\r?\n/g, '');  // Remove all newlines

const certHeader = `Cert="${cert}"`; // Ensure proper Cert="..."

console.log("Formatted Certificate Header:", certHeader);

// Axios HTTPS Agent (for mTLS)
const agent = new https.Agent({
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('rootCA.crt'),
    rejectUnauthorized: false  // Set to true for strict TLS validation
});

// Make the request
axios.get('http://192.168.178.29:3000/v0/dataSubscriptions', {
    headers: {
        'x-forwarded-client-cert': certHeader,
        'bdcfos-producer-tenantid': '1234'
    },
    params: {
        producer: "abcd",
        subscriber: "somethingmore/lala"
    },
    httpsAgent: agent
})
.then(response => {
    console.log("Response Status:", response.status);
    console.log("Response Data:", response.data);
})
.catch(error => {
    console.error("Error:", error.response ? error.response.data : error.message);
});
