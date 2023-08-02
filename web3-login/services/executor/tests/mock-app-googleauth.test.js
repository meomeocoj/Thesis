const express = require("express");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
const path = require("path");

const cors = require("cors");
const jwt = require("jsonwebtoken");

const privateKey = "cffc6c7bb1cdc303f47e19ce4230946f18be2ef0d2614baa2af5c9db4a3f7859b194127d6de552030cce3dc8e15ac495";
const logger = require("../src/config/logger");
// need to change follow by client secret
const clientSecretName =
  "../client_secret_395623626332-7slje72gkemor29kt3nms99jiotostr5.apps.googleusercontent.com.json";
const clientSecretData = JSON.parse(fs.readFileSync(path.join(__dirname, clientSecretName)));

const googleClient = new OAuth2Client({
  clientId: clientSecretData.web.client_id,
  clientSecret: clientSecretData.web.client_secret,
  redirectUri: "http://localhost:3000/google/callback",
});

const authUrl = googleClient.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
  include_granted_scopes: true,
});

const app = express();

app.use(cors());
app.get("/", (_req, res) => {
  res.redirect(authUrl);
});

app.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);
  res.redirect("/google/tokens");
});

app.get("/google/tokens", (_req, res) => {
  res.json(googleClient.credentials);
});

app.get("/tokeninfo", (req, res) => {
  const { id_token } = req.query;
  try {
    const decodedData = jwt.verify(id_token, privateKey);
    return res.json(decodedData);
  } catch (err) {
    return res.status(400).send(err.message);
  }
});

app.get("/idtoken", (_req, res) => {
  const data = {
    iss: "http://localhost:3000/",
    email: "tminh0204@gmail.com",
    aud: "http://localhost:3000/",
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const idToken = jwt.sign(data, privateKey);
  return res.status(200).json({ idToken });
});

app.listen(3000, () => {
  logger.info("Listen on port 3000");
});

module.exports = { app, privateKey };
