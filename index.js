const puppeteer = require("puppeteer"); // Require Puppeteer module
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { count } = require("console");
const cron = require('node-cron');


const url = "https://mystudentrecord.ucmerced.edu/pls/PROD/xhwschedule.P_ViewCrnDetail?subjcode=CRES&crsenumb=001&validterm=202230&crn=34276"; // Set website you want to screenshot

cron.schedule('* 12 * * *', function() {
  console.log('running a task');
  main();
});



const getTableElements = async () => {
  var jsonClean = { courseName: "", seats: "", remaining: "" };
  const browser = await puppeteer.launch(); // Launch a "browser"
  const page = await browser.newPage(); // Open new page
  await page.goto(url); // Go website
  await page.waitForSelector("body > div.pagebodydiv > table:nth-child(9)"); // Method to ensure that the element is loaded
  const tableValues = await page.evaluate(() =>
    Array.from(document.getElementsByClassName("dddefault"), (e) => e.innerText)
  ); // t.jsonValue();
  console.log(tableValues);

  jsonClean.courseName = tableValues[0];
  jsonClean.seats = Number.parseInt(tableValues[5]);
  jsonClean.remaining = Number.parseInt(tableValues[6]);

  // await page.pdf({ path: "test1.pdf" });

  await page.close(); // Close the website
  await browser.close(); // Close the browser
  return jsonClean;
};

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

function main() {

  fs.readFile("./credentials.json", async (err, content) => {
    if (err) return console.log("Error loading client secret file:", err);
    // Authorize a client with credentials, then call the Gmail API.
    const { courseName, seats, remaining } = await getTableElements();
    

    if (remaining >= 0) {
      const sendEmailCallBack = (auth) =>
        sendEmail(
          auth,
          "tapiamichael19@gmail.com",
          "Open Seat in "+ courseName + "!",
          remaining + "\nCRN = 34276"
        );
      authorize(JSON.parse(content), sendEmailCallBack);
    } 
  });

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  }

  /**
   * Lists the labels in the user's account.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  function listLabels(auth) {
    const gmail = google.gmail({ version: "v1", auth });
    gmail.users.labels.list(
      {
        userId: "me",
      },
      (err, res) => {
        if (err) return console.log("The API returned an error: " + err);
        const labels = res.data.labels;
        if (labels.length) {
          console.log("Labels:");
          labels.forEach((label) => {
            console.log(`- ${label.name}`);
          });
        } else {
          console.log("No labels found.");
        }
      }
    );
  }
  // https://github.com/googleapis/google-api-nodejs-client#google-apis-nodejs-client
  function makeBody(to, from, subject, message) {
    var str = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      "MIME-Version: 1.0\n",
      "Content-Transfer-Encoding: 7bit\n",
      "to: ",
      to,
      "\n",
      "from: ",
      from,
      "\n",
      "subject: ",
      subject,
      "\n\n",
      message,
    ].join("");
    console.log(str);

    var encodedMail = Buffer.from(str)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return encodedMail;
  }

  async function sendEmail(auth, to, subject, message) {
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.send({
      // The user's email address. The special value `me` can be used to indicate the authenticated user.
      auth: auth,

      userId: "me",
      resource: {
        raw: makeBody(to, "me", subject, message),
      },
    });
    console.log(res.data);
  }
}
