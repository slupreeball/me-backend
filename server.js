const express = require('express')
const cors = require('cors')
const mysql = require('mysql2');
const mssql = require('mssql');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const axios = require('axios');
// const path = require('path');

const nodemailer = require('nodemailer');

const fileupload = require("express-fileupload");

const app = express()
app.use(cors())
app.use(express.json())
dotenv.config();



const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

app.use(bodyParser.json());
app.use(
  fileupload({
    useTempFiles: true,
    safeFileNames: true,
    preserveExtension: true,
    tempFileDir: `${__dirname}/assets/upload/`,
  })
);

const omiseApiUrl = process.env.OPN_API;
const omiseSecretKey = process.env.OPN_SKEY;
const omisePublicKey = process.env.OPN_PKEY;


const mailHtmlTxt = (email, id, code) => {
  const mailTxt = `
  <div style="padding:0;margin:0;font-family: 'Kanit','Helvetica';color:#242424;font-weight: bold;font-size: 14px;">
  <div style="text-align: center; padding-bottom:20px; border-bottom: solid 1px #ebebeb;">
      <img alt="logo" src="https://mesoestetic-th.com/wp-content/uploads/2023/09/NEW-LOGO-MESOESTETIC.png"
          width="200">
  </div>
  <div style="text-align: center; padding: 40px 20px;">
      <h2>คุณได้ขอรีเซ็ตรหัสผ่าน <br> mesoestetic-th shop</h2>
      <p>รหัสสำหรับเปลี่ยนรหัสผ่าน </p>
      <p style="margin: 10px 0;"><strong
              style="padding: 10px 20px;font-size: 30px; background-color: #c8c8c8;">`+ code + `</strong></p>
      <p> คลิกเพื่อตั้งค่ารหัสผ่านใหม่ : <a
              href="https://mesoestetic-th-shop.web.app/change-password?key_reset_id=`+ id + `&login=` + email + `"><b>คลิก</b></a></p>
  </div>
  <footer>
      <div style="text-align:center;margin-top: 2%;padding: 20px;border-top: solid 1px #ebebeb;"><span>© 2024
              mesoestetic thailand shop All Rights Reserved</span></div>
  </footer>
</div>
  `
  return mailTxt
}

const transponter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const Omise = require('omise')({
  publicKey: omisePublicKey,
  secretKey: omiseSecretKey,
});


app.get('/user-all', function (req, res, next) {
  connection.query(
    "SELECT * FROM `wp_users`",
    function (err, results) {
      res.json(results);
    }
  );
})

app.get('/products/:id', function (req, res, next) {
  const productID = req.params.id;
  connection.query(
    " SELECT p.ID as product_id," +
    " p.post_title as product_title," +
    " pm1.meta_value as regular_price," +
    " pm2.meta_value as sale_price," +
    " pmPrice.meta_value as price," +
    " pm_status.meta_value as stock_status" +
    " FROM wp_posts p" +
    " JOIN wp_postmeta pm1 ON p.ID = pm1.post_id" +
    " LEFT JOIN wp_postmeta pm_status ON p.ID = pm_status.post_id" +
    " LEFT JOIN wp_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_sale_price'" +
    " LEFT JOIN wp_postmeta pmPrice ON p.ID = pmPrice.post_id AND pmPrice.meta_key = '_price'" +
    " WHERE p.post_type = 'product'" +
    " AND p.post_status = 'publish'" +
    " AND pm1.meta_key = '_regular_price'" +
    " AND pm_status.meta_key = '_stock_status'" +
    " AND p.ID = ?", [productID],
    function (err, results) {
      res.json(results);
    }
  );
})

app.get('', async (req, res) => {
  try {
    const charge = 'Welcome API';
    res.status(200).json(charge);
  } catch (error) {
    console.error('Error creating charge:', error);
    res.status(500).json({ error: 'Error creating charge' });
  }
});

app.get('/getstatus-charge/:id', async (req, res) => {
  try {
    const chargeId = req.params.id;
    const charge = await getChargeID(chargeId);
    res.status(200).json(charge);
  } catch (error) {
    console.error('Error creating charge:', error);
    res.status(500).json({ error: 'Error creating charge' });
  }
});


app.post('/testsendmail', function (req, res) {
  const resetCode = Math.floor(100000 + Math.random() * 900000);
  // Send the code to the user's email
  const mailOptions = {
    from: process.env.MAIL_USER,
    to: 'nugin2010@gmail.com',
    subject: 'Password Reset Code',
    text: `Your password reset code is: ${resetCode}`,
  };

  transponter.sendMail(mailOptions);
})

app.post('/rest-password', async (req, res) => {
  try {
    const email = req.body.user_login;
    const id = req.body.key_reset_id;
    const code = req.body.key_reset_code;
    const option = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'รีเซ็ตรหัสผ่าน mesoestetic-th shop',
      html: mailHtmlTxt(email, id, code)
    }

    const massage = [{
      user_login: email,
      key_reset_id: id,
      key_reset_code: code,
    }]
    transponter.sendMail(option);

    res.json(massage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Source creation failed' });
  }
});

app.post('/create-source', async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    const source = await Omise.sources.create({
      amount: 150000,
      currency: 'THB',
      type: 'mobile_banking_kbank',
    });

    res.json({ success: true, source });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Source creation failed' });
  }
});

// Endpoint to generate an Omise token
app.post('/generate-token', (req, res) => {
  const cardDetails = {
    expiration_month: req.body.expiration_month,
    expiration_year: req.body.expiration_year,
    name: req.body.name,
    number: req.body.number,
    security_code: req.body.security_code,
  };

  Omise.tokens.create({ card: cardDetails }, (err, token) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Token creation failed' });
    }

    res.json(token);
  });
});


app.post('/create-charge', async (req, res) => {
  const data = req.body;
  try {
    const source = await Omise.charges.create(data);

    res.json({ success: true, source });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Source creation failed' });
  }
});

async function createSource(data) {
  const omiseHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(omisePublicKey + ':').toString('base64')}`,
  };

  const requestData = data

  try {
    const response = await axios.post(`${omiseApiUrl}/sources`, requestData, {
      headers: omiseHeaders,
    });

    return response.data.id;
  } catch (error) {
    throw error;
  }
}

async function createCharge(data) {
  const omiseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Basic ${Buffer.from(omiseSecretKey + ':').toString('base64')}`,
  };

  const requestData = {
    amount: data.amount,
    currency: data.currency,
    platform_type: data.platform_type,
    type: data.type,
    return_uri: data.return_uri,
    source: data.source,
    description: data.description,
  };

  console.log('requestData: ', requestData)

  try {
    const response = await axios.post(`${omiseApiUrl}/charges`, requestData, {
      headers: omiseHeaders,
    });

    return response;

  } catch (error) {

    return error;
  }
}


async function getChargeID(chargeId) {
  const omiseHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(omiseSecretKey + ':').toString('base64')}`,
  };
  try {
    const response = await axios.get(`${omiseApiUrl}/charges/${chargeId}`, {
      headers: omiseHeaders,
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}




app.listen(5001, function () {
  console.log('CORS-enabled web server listening on port 5001')
  //console.log("test")
})