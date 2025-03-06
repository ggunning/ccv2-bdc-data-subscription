const fs = require("fs");
const axios = require("axios");
const https = require("https");

// ** Read and format the certificate correctly **
let cert = fs.readFileSync("client.crt", "utf8").replace(/\r?\n/g, "");
cert = `Cert=${cert}`;

// ** Debugging: Check if the cert is correctly formatted **
console.log("🔹 Formatted Certificate Header:", cert);

// ** Create an HTTPS agent to handle mTLS **
const httpsAgent = new https.Agent({
  cert: fs.readFileSync("client.crt"),
  key: fs.readFileSync("client.key"),
  ca: fs.readFileSync("rootCA.crt"),
  rejectUnauthorized: false, // Set to `true` for production
});

// ** API Endpoint **
const url = "http://192.168.178.29:3000/v0/dataSubscriptions";

// ** Headers **
const headers = {
  "Content-Type": "application/json",
  "x-forwarded-client-cert": `Cert="${cert}"`,
  "bdcfos-producer-tenantid": "1234",
};

// ** JSON Payload for POST Request **
const postData = {
  subscriber: "/eu10/sap.bdcfos/6fd6236b-eb91-464e-9dff-1aa51396e06a",
  producer: "/us-west-2/sap.fieldglass/tenant123",
  dataSourceId: "sap.fieldglass:dataProduct:JobPosting:v1.0.0",
  schedule: "0 8 * * *",
  beginWatermark: "2022-12-16T14:22:04Z",
  destinationPath: "/staging/blob/sap.fieldglass/v1/jobposting",
};

// ** Function to make POST request **
const makePostRequest = async () => {
  try {
    const response = await axios.post(url, postData, { headers, httpsAgent });
    console.log("✅ POST Response Data:", response.data);
  } catch (error) {
    console.error("❌ POST Request Failed:", error.response ? error.response.data : error.message);
  }
};

// ** Run both requests sequentially **
(async () => {
  console.log("🚀 Starting API Requests...");
  
  await makePostRequest(); // POST Request
})();
