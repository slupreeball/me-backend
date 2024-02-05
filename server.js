const express = require('express')
const cors = require('cors')
const mysql = require('mysql2');
//const mssql = require('mssql');
//const mssql2 = require('mssql');
const dotenv = require('dotenv');
var bodyParser = require('body-parser')
const bcrypt = require('bcrypt');
const saltRounds = 10;
var jwt = require('jsonwebtoken');
const secret = 'QMS2024';

const app = express()
app.use(cors())
app.use(express.json())
dotenv.config();

// create application/json parser
var jsonParser = bodyParser.json()

//# ---------------------------------
//# config for your database MYSQL
//# ---------------------------------
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

// config for your database MSSQL
const config = {
    server: process.env.MSSQL_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.MSSQL_USERNAME, // update me
            password: process.env.MSSQL_PASSWORD // update me
         }
    },
    options: {
        database: process.env.MSSQL_DATABASE,
        validateBulkLoadParameters:false,
        encrypt: false,
    }
};

connection.connect((err) => {
    if (err) {
        console.log('Error connecting to MySQL Database = ', err)
        return;
    }
    console.log("MySQL successfully connected.", process.env.MYSQL_HOST,":" , process.env.MYSQL_DATABASE);
})

/*
mssql.connect(config, function (err) {   
    if (err) {
        console.log('Error connecting to MSSQL Database = ', err)
        return;
    }
    console.log("MSSQL successfully connected.", process.env.MSSQL_DATABASE);
});
*/

//# ---------------------------------
//# ผู้ใช้งาน
//# ---------------------------------

  //เพิ่มผู้ใช้งาน
  app.post('/adduser', function (req, res, next) {

    let myemail=req.body.email;
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    let validemail=re.test(myemail.toLowerCase());

    if(validemail==false)
    {
        res.json({
            status:false,
            message:'Please enter a valid email id.'
        })
    }
    else {

      bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        // Store hash in your password DB.
        connection.execute(
          'INSERT INTO `users` ' +
          ' (`firstname`, `lastname`, `company_id`, `role`, `country`, `email`, `avatar` , `password`, `remember_token`, `created_at`, `updated_at`) ' +
          ' VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [ req.body.firstname, 
            req.body.lastname, 
            req.body.company_id,
            req.body.role,
            req.body.country,
            req.body.email,
            req.body.avatar,
            hash,
            req.body.remember_token,
            req.body.created_at,
            req.body.updated_at],
          function(err) {
            if (err) {

              res.json({status: 'error', message: err})
              /*
              if(err.sqlMessage == 'Duplicate entry \''+req.body.email+'\' for key \'users.email_UNIQUE\'')
                {
                  res.json({
                      status:false,
                      message:myemail+' You are already registered with this email address'
                  })
                } else {
                  res.json({
                      status:false,
                      message: err.sqlMessage
                  })
                }
              //
              */
              return
            }
            res.json({status: "ok", message: req.body.email + ' was created.' });
          }
        );
      });
    }
  })

  //Login ผู้ใช้งาน
  app.post('/login', function (req, res, next) {
    connection.execute(
      'SELECT * FROM `users` WHERE email=? ', 
      [req.body.email],
      function(err, users, fields) {
        if (err) { res.json({status: 'error', message: err}); return }
        if (users.length == 0) { res.json({status: 'error', message: 'no user found'}); return}
        // Load hash from your password DB.
        bcrypt.compare(req.body.password, users[0].password, function(err, isLogin) {
          if (isLogin) {
            var token = jwt.sign({ email: users[0].email, user_id: users[0].user_id }, secret, { expiresIn: '24h' });

            //Return email, user_id ไว้ใช้ในการบันทึกข้อมูล
            var email = users[0].email;
            var user_id = users[0].user_id

            res.json({status: 'ok', message: 'login success', token, email, user_id})
          } else {
            res.json({status: 'error', message: 'Check your password. '})
          }
        });
      }
    );
  })

  //Authen ผู้ใชงาน
  app.post('/authen', jsonParser, function (req, res, next) {
    try {
      const token = req.headers.authorization.split(' ')[1]
      var decoded = jwt.verify(token, secret);
      res.json({status: 'ok', decoded, email: decoded.email, user_id: decoded.user_id})
    } catch (err) {
      res.json({status: '', message: err.message})
    }
  })

  //ข้อมูลผู้ใช้งานทั้งหมด
  app.get('/allusers', function (req, res, next) {
    connection.query(
      ' SELECT * ' + 
      ' FROM `users` ' , 
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json(results);
      }
    );
  })

  //ข้อมูลผู้ใช้งานตาม id
  app.get('/user/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' SELECT * ' + 
      ' FROM `users` ' + 
      ' WHERE `user_id` = ?', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        //console.log(results)
        //res.json(results);
        res.json({status: 'ok', user: results})
      }
    );
  })

  //อัปเดทข้อมูลผู้ใช้งาน
  app.put('/updateuser/:id', function (req, res, next) {
    const id = req.params.id;
    const firstname = req.body.firstname;
    const lastname =  req.body.lastname;
    const email = req.body.email;
    const avatar = req.body.avatar;
    const updated_at = req.body.updated_at;
    connection.query(
      ' UPDATE `users` ' + 
      ' SET `firstname` = ?, ' + 
      ' `lastname` = ?, ' + 
      ' `email` = ?, ' + 
      ' `avatar` = ?, ' + 
      ' `updated_at` = ?' + 
      ' WHERE `user_id` = ? ', 
      [firstname, lastname, email, avatar,updated_at, id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        //res.json(results);
        res.json({status: 'ok', user: results});
      }
    );
  })

  //ลบข้อมูลผู้ใช้งาน
  app.delete('/deleteuser/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' DELETE FROM `users` ' + 
      ' WHERE `user_id` = ? ', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json({status: 'ok', message: 'User id: ' + id + ' was deleted.'});
        //res.json(results, {message: 'User id: ' + id + ' was deleted.'});
        //res.json({status: 'ok', message: 'login success', token})
      }
    );
  })

  //# ---------------------------------
  //# ข้อมูลรถบรรทุก table: cars
  //# ---------------------------------

  //เพิ่มข้อมูลรถ
  app.post('/addcar', function (req, res, next) {
    connection.execute(
      'INSERT INTO `cars` ' +
      ' (`user_id`, `registration_no`, `brand`, `color`, `created_at`, `updated_at`) ' +
      ' VALUES (?,?,?,?,?,?)',
      [ req.body.user_id, 
        req.body.registration_no, 
        req.body.brand,
        req.body.color,
        req.body.created_at,
        req.body.updated_at],
      function(err) {
        if (err) {
          res.json({status: 'error', message: err})
          return
        }
        res.json({status: "ok"});
      }
    );
  })

  //ข้อมูลรถทั้งหมด
  app.get('/allcars', function (req, res, next) {
    connection.query(
      ' SELECT * ' + 
      ' FROM `cars` ' , 
      function(err, results) {
        if (err) {
          console.log('Error cars = ', err)
          return;
        }
        res.json(results);
      }
    );
  })

  //ข้อมูลรถตาม id
  app.get('/car/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' SELECT * ' + 
      ' FROM `cars` ' + 
      ' WHERE `car_id` = ?', 
      [id],
      function(err, results) {
        if (err) {
          console.log('Error cars = ', err)
          return;
        }
        res.json({status: 'ok', car: results})
      }
    );
  })

  //อัปเดทข้อมูลรถ
  app.put('/updatecar/:id', function (req, res, next) {
    const id = req.params.id;
    const registration_no = req.body.registration_no;
    const brand =  req.body.brand;
    const color = req.body.color;
    connection.query(
      ' UPDATE `cars` ' + 
      ' SET `registration_no` = ?, ' + 
      ' `brand` = ?, ' + 
      ' `color` = ? ' + 
      ' WHERE `car_id` = ? ', 
      [registration_no, brand, color, id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json({status: 'ok', user: results});
      }
    );
  })

  //ลบข้อมูลรถ
  app.delete('/deletecar/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' DELETE FROM `cars` ' + 
      ' WHERE `car_id` = ? ', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        //res.json({status: 'ok', user: results});
        res.json({status: 'ok', message: 'Car id: ' + id + ' was deleted.'});
      }
    );
  })

  //# ---------------------------------
  //# ข้อมูลบริษัท/ร้านค้า table: company
  //# ---------------------------------

  //ข้อมูลบริษัท/ร้านค้า
  app.post('/addcompany', function (req, res, next) {
    connection.execute(
      'INSERT INTO `company` ' +
      ' (`user_id`,`name`,`country`,`open_time`, ' +
      ' `description`,`tax_no`,`phone`,`address`,' +
      ' `zipcode`,`location_lat`,`location_lng`,`contact_person`,`contact_number`,`created_at`,`updated_at`)' +
      ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [ req.body.user_id, 
        req.body.name, 
        req.body.country,
        req.body.open_time,
        req.body.description,
        req.body.tax_no,
        req.body.phone,
        req.body.address,
        req.body.zipcode,
        req.body.location_lat,
        req.body.location_lng,
        req.body.contact_person,
        req.body.contact_number,
        req.body.created_at,
        req.body.updated_at],
      function(err) {
        if (err) {
          res.json({status: 'error', message: err})
          return
        }
        res.json({status: "ok"});
      }
    );
  })

  //ข้อมูลบริษัท/ร้านค้าทั้งหมด
  app.get('/allcompany', function (req, res, next) {
    connection.query(
      ' SELECT * ' + 
      ' FROM `company` ' , 
      function(err, results) {
        if (err) {
          console.log('Error cars = ', err)
          return;
        }
        res.json(results);
        //res.json({status: 'ok', company: results})
      }
    );
  })

  //ข้อมูลบริษัท/ร้านค้า ตาม id
  app.get('/company/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' SELECT * ' + 
      ' FROM `company` ' + 
      ' WHERE `company_id` = ?', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        //res.json(results);
        res.json({status: 'ok', company: results})
      }
    );
  })

  //อัปเดทข้อมูลบริษัท/ร้านค้า
  app.put('/updatecompany/:id', function (req, res, next) {
    const id = req.params.id;
    const user_id = req.body.user_id;
    const name = req.body.name; 
    const country = req.body.country;
    const open_time = req.body.open_time;
    const description = req.body.description;
    const tax_no = req.body.tax_no;
    const phone = req.body.phone;
    const address = req.body.address;
    const zipcode = req.body.zipcode;
    const location_lat = req.body.location_lat;
    const location_lng = req.body.location_lng;
    const contact_person = req.body.contact_person;
    const contact_number = req.body.contact_number;
    const updated_at = req.body.updated_at;
    connection.query(
      ' UPDATE `company` ' + 
      ' SET `user_id` = ?, ' + 
      ' `name` = ?, ' + 
      ' `country` = ?, ' + 
      ' `open_time` = ?, ' + 
      ' `description` = ?, ' + 
      ' `tax_no` = ?, ' + 
      ' `phone` = ?, ' + 
      ' `address` = ?, ' + 
      ' `zipcode` = ?, ' + 
      ' `location_lat` = ?, ' + 
      ' `location_lng` = ?, ' + 
      ' `contact_person` = ?,' +
      ' `contact_number` = ?,' +
      ' `updated_at` = ? ' + 
      ' WHERE `company_id` = ? ', 
      [user_id, 
        name, 
        country, 
        open_time, 
        description, 
        tax_no,
        phone,
        address,
        zipcode,
        location_lat,
        location_lng,
        contact_person,
        contact_number,
        updated_at,
        id],
      function(err, results) {
        if (err) {
          //console.log('Error company update = ', err)
          res.json({status: 'error', message: err})
          return;
        }
        //res.json(results);
        res.json({status: 'ok', company: results});
      }
    );
  })

  //ลบข้อมูลบริษัท/ร้านค้า
  app.delete('/deletecompany/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' DELETE FROM `company` ' + 
      ' WHERE `company_id` = ? ', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        //res.json(results);
        res.json({status: 'ok', message: 'Company id: ' + id + ' was deleted.'});
      }
    );
  })

  //# ---------------------------------
  //# ข้อมูลคนขับรถ table: drivers
  //# ---------------------------------

  //เพิ่มข้อมูลคนขับรถ
  app.post('/adddriver', function (req, res, next) {
    connection.execute(
      'INSERT INTO `drivers` ' +
      '(`user_id`,`firstname`,`lastname`,`license_no`,' +
      '`created_at`,`updated_at`)' +
      ' VALUES (?,?,?,?,?,?)',
      [ req.body.user_id, 
        req.body.firstname, 
        req.body.lastname,
        req.body.license_no,
        req.body.created_at,
        req.body.updated_at],
      function(err) {
        if (err) {
          res.json({status: 'error', message: err})
          return
        }
        res.json({status: "ok"});
      }
    );
  })

  //ข้อมูลคนขับรถทั้งหมด
  app.get('/alldrivers', function (req, res, next) {
    connection.query(
      ' SELECT * ' + 
      ' FROM `drivers` ' , 
      function(err, results) {
        if (err) {
          //console.log('Error drivers = ', err)
          res.json({status: 'error', message: err})
          return;
        }
        res.json(results);
      }
    );
  })

  //ข้อมูลคนขับรถ ตาม id
  app.get('/driver/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' SELECT * ' + 
      ' FROM `drivers` ' + 
      ' WHERE `driver_id` = ?', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json({status: 'ok', driver: results})
      }
    );
  })

  //อัปเดทข้อมูลคนขับรถ
  app.put('/updatedriver/:id', function (req, res, next) {
    const id = req.params.id;
    const user_id = req.body.user_id;
    const firstname = req.body.firstname; 
    const lastname = req.body.lastname;
    const license_no = req.body.license_no;
    const updated_at = req.body.updated_at;
    connection.query(
      ' UPDATE `drivers` ' + 
      ' SET `user_id` = ?, ' + 
      ' `firstname` = ?, ' + 
      ' `lastname` = ?, ' + 
      ' `license_no` = ?, ' + 
      ' `updated_at` = ? ' + 
      ' WHERE `driver_id` = ? ', 
      [user_id, 
        firstname, 
        lastname, 
        license_no, 
        updated_at,
        id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json({status: 'ok', user: results});
      }
    );
  })

  //ลบข้อมูลคนขับรถ
  app.delete('/deletedriver/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' DELETE FROM `drivers` ' + 
      ' WHERE `driver_id` = ? ', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          return;
        }
        res.json({status: 'ok', message: 'Driver id: ' + id + ' was deleted.'});
      }
    );
  })

  //# ---------------------------------
  //# ข้อมูลโกดัง table: warehouses
  //# ---------------------------------

  //เพิ่มข้อมูลโกดัง
  app.post('/addwarehouse', function (req, res, next) {
    connection.execute(
      'INSERT INTO `warehouses` ' +
      '(`description`,' +
      '`created_at`,`updated_at`)' +
      ' VALUES (?,?,?)',
      [ req.body.description, 
        req.body.created_at,
        req.body.updated_at],
      function(err) {
        if (err) {
          res.json({status: 'error', message: err})
          return
        }
        res.json({status: "ok"});
      }
    );
  })

  //ข้อมูลโกดังทั้งหมด
  app.get('/allwarehouses', function (req, res, next) {
    connection.query(
      ' SELECT * ' + 
      ' FROM `warehouses` ' , 
      function(err, results) {
        if (err) {
          //console.log('Error drivers = ', err)
          res.json({status: 'error', message: err})
          return;
        }
        res.json(results);
      }
    );
  })

  //ข้อมูลโกดัง ตาม id
  app.get('/warehouse/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' SELECT * ' + 
      ' FROM `warehouses` ' + 
      ' WHERE `warehouse_id` = ?', 
      [id],
      function(err, results) {
        if (err) {
          res.json({status: 'error', message: err})
          //console.log('Error cars = ', err)
          return;
        }
        res.json(results);
      }
    );
  })

  //อัปเดทข้อมูลโกดัง
  app.put('/updatewarehouse/:id', function (req, res, next) {
    const id = req.params.id;
    const description = req.body.description;
    const updated_at = req.body.updated_at;
    connection.query(
      ' UPDATE `warehouses` ' + 
      ' SET `description` = ?, ' + 
      ' `updated_at` = ? ' + 
      ' WHERE `warehouse_id` = ? ', 
      [description, 
        updated_at,
        id],
      function(err, results) {
        if (err) {
          //console.log('Error warehouses update = ', err)
          res.json({status: 'error', message: err})
          return;
        }
        res.json(results);
      }
    );
  })

  //ลบข้อมูลโกดัง
  app.delete('/deletewarehouse/:id', function (req, res, next) {
    const id = req.params.id;
    connection.query(
      ' DELETE FROM `warehouses` ' + 
      ' WHERE `warehouse_id` = ? ', 
      [id],
      function(err, results) {
        if (err) {
          //console.log('Error warehouse delete = ', err)
          res.json({status: 'error', message: err})
          return;
        }
        res.json(results);
      }
    );
  })

//# ---------------------------------------------
//# กลุ่มของสถานีให้บริการ table: station_group
//# ---------------------------------------------

//เพิ่มข้อมูลกลุ่มของสถานีให้บริการ
app.post('/addstationgroup', function (req, res, next) {
  connection.execute(
    'INSERT INTO `station_group` ' +
    '(`description`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?)',
    [ req.body.description, 
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//ข้อมูลกลุ่มของสถานีให้บริการทั้งหมด
app.get('/allstationgroup', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `station_group` ' , 
    function(err, results) {
      if (err) {
        //console.log('Error station_group = ', err)
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูลกลุ่มของสถานีให้บริการ ตาม id
app.get('/stationgroup/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `station_group` ' + 
    ' WHERE `station_group_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        //console.log('Error cars = ', err)
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลกลุ่มของสถานีให้บริการ
app.put('/updatestationgroup/:id', function (req, res, next) {
  const id = req.params.id;
  const description = req.body.description;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `station_group` ' + 
    ' SET `description` = ?, ' + 
    ' `updated_at` = ? ' + 
    ' WHERE `station_group_id` = ? ', 
    [description, 
      updated_at,
      id],
    function(err, results) {
      if (err) {
        //console.log('Error station_group update = ', err)
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลกลุ่มของสถานีให้บริการ
app.delete('/deletestationgroup/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `station_group` ' + 
    ' WHERE `station_group_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        //console.log('Error station_group delete = ', err)
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# สถานีให้บริการ table: stations
//# ---------------------------------------------

//เพิ่มข้อมูลสถานีให้บริการ
app.post('/addstation', function (req, res, next) {
  connection.execute(
    'INSERT INTO `stations` ' +
    '(`station_group_id`,`warehouse_id`,`station_code`,`station_description`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?)',
    [ req.body.station_group_id, 
      req.body.warehouse_id,
      req.body.station_code,
      req.body.station_description,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//ข้อมูลสถานีให้บริการทั้งหมด
app.get('/allstations', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `stations` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูลสถานีให้บริการ ตาม id
app.get('/station/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `stations` ' + 
    ' WHERE `station_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลสถานีให้บริการ
app.put('/updatestation/:id', function (req, res, next) {
  const id = req.params.id;
  const station_group_id = req.body.station_group_id;
  const warehouse_id = req.body.warehouse_id;
  const station_code = req.body.station_code;
  const station_description = req.body.station_description;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `stations` ' + 
    ' SET `station_group_id` = ?, ' + 
    ' `warehouse_id` = ?,' + 
    ' `station_code` = ?,' + 
    ' `station_description` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `station_id` = ? ', 
    [ station_group_id, 
      warehouse_id,
      station_code,
      station_description,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลสถานีให้บริการ
app.delete('/deletestation/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `stations` ' + 
    ' WHERE `station_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ข้อมูลสินค้า table: product
//# ---------------------------------------------

//Add product
app.post('/addproduct', function (req, res, next) {
  connection.execute(
    'INSERT INTO `products` ' +
    '(`name`,`category`,`unit_price`,`stock_quantity`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?)',
    [ req.body.name, 
      req.body.category,
      req.body.unit_price,
      req.body.stock_quantity,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//All products
app.get('/allproducts', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `products` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//Product by id
app.get('/product/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `products` ' + 
    ' WHERE `product_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลสินค้า
app.put('/updateproduct/:id', function (req, res, next) {
  const id = req.params.id;
  const name = req.body.name;
  const category = req.body.category;
  const unit_price = req.body.unit_price;
  const stock_quantity = req.body.stock_quantity;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `products` ' + 
    ' SET `name` = ?, ' + 
    ' `category` = ?,' + 
    ' `unit_price` = ?,' + 
    ' `stock_quantity` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `product_id` = ? ', 
    [ name, 
      category,
      unit_price,
      stock_quantity,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลสินค้า
app.delete('/deleteproduct/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `products` ' + 
    ' WHERE `product_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ข้อมูลสินค้า table: orders
//# ---------------------------------------------

//Add order
app.post('/addorder', function (req, res, next) {
  connection.execute(
    'INSERT INTO `orders` ' +
    '(`reseve_id`,`ref_order_id`,`company_id`,`description`,`order_date`,`total_amount`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?,?,?)',
    [ req.body.reseve_id, 
      req.body.ref_order_id,
      req.body.company_id,
      req.body.description,
      req.body.order_date,
      req.body.total_amount,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//All orders
app.get('/allorders', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `orders` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูล order ตาม id
app.get('/order/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `orders` ' + 
    ' WHERE `order_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# Update order
app.put('/updateorder/:id', function (req, res, next) {
  const id = req.params.id;
  const reseve_id = req.body.reseve_id;
  const ref_orde_id = req.body.ref_order_id;
  const company_id = req.body.company_id;
  const description = req.body.description;
  const order_date = req.body.order_date;
  const total_amount = req.body.total_amount;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `orders` ' + 
    ' SET `reseve_id` = ?, ' + 
    ' `ref_order_id` = ?,' + 
    ' `company_id` = ?,' + 
    ' `description` = ?,' + 
    ' `order_date` = ?,' + 
    ' `total_amount` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `order_id` = ? ', 
    [ reseve_id, 
      ref_orde_id,
      company_id,
      description,
      order_date,
      total_amount,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูล order
app.delete('/deleteorder/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `orders` ' + 
    ' WHERE `order_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ข้อมูลสินค้า table: orders_items
//# ---------------------------------------------

//Add order items
app.post('/addorderitem', function (req, res, next) {
  connection.execute(
    'INSERT INTO `orders_items` ' +
    '(`order_id`,`product_id`,`quantity`,`subtotal`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?)',
    [ req.body.order_id, 
      req.body.product_id,
      req.body.quantity,
      req.body.subtotal,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//All order items
app.get('/allorderitems', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `orders_items` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูล order item ตาม id
app.get('/orderitem/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `orders_items` ' + 
    ' WHERE `item_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# Update order items
app.put('/updateorderitem/:id', function (req, res, next) {
  const id = req.params.id;
  const order_id = req.body.order_id;
  const product_id = req.body.product_id;
  const quantity = req.body.quantity;
  const subtotal = req.body.subtotal;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `orders_items` ' + 
    ' SET `order_id` = ?, ' + 
    ' `product_id` = ?,' + 
    ' `quantity` = ?,' + 
    ' `subtotal` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `item_id` = ? ', 
    [ order_id,
      product_id,
      quantity,
      subtotal,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูล order item
app.delete('/deleteorderitem/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `orders_items` ' + 
    ' WHERE `item_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ลำดับการให้บริการ table: steps
//# ---------------------------------------------

//เพิ่มข้อมูลลำดับการให้บริการ
app.post('/addstep', function (req, res, next) {
  connection.execute(
    'INSERT INTO `steps` ' +
    '(`order`,`description`,`queue_id`,`status`,`station_id`,`remark`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?,?,?)',
    [ req.body.order, 
      req.body.description,
      req.body.queue_id,
      req.body.status,
      req.body.station_id,
      req.body.remark,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//ข้อมูลลำดับการให้บริการ
app.get('/allsteps', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `steps` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูลลำดับการให้บริการ ตาม id
app.get('/step/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `steps` ' + 
    ' WHERE `step_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลลำดับการให้บริการ
app.put('/updatestep/:id', function (req, res, next) {
  const id = req.params.id;
  const order = req.body.order;
  const description = req.body.description;
  const queue_id = req.body.queue_id;
  const status = req.body.status;
  const station_id = req.body.station_id;
  const remark = req.body.remark;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `steps` ' + 
    ' SET `order` = ?, ' + 
    ' `description` = ?,' + 
    ' `queue_id` = ?,' + 
    ' `status` = ?,' + 
    ' `station_id` = ?,' +
    ' `remark` = ?,' +
    ' `updated_at` = ? ' + 
    ' WHERE `step_id` = ? ', 
    [ order, 
      description,
      queue_id,
      status,
      station_id,
      remark,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลลำดับการให้บริการ
app.delete('/deletestep/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `steps` ' + 
    ' WHERE `step_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ข้อมูลการจองคิว table: reserves
//# ---------------------------------------------

//เพิ่มข้อมูลการจองคิว
app.post('/addreserve', function (req, res, next) {
  connection.execute(
    'INSERT INTO `reserves` ' +
    '(`user_id`,`description`,`company_id`,`car_id`,`driver_id`,`status`,`total_quantity`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?,?,?,?,?)',
    [ req.body.user_id, 
      req.body.description,
      req.body.company_id,
      req.body.car_id,
      req.body.driver_id,
      req.body.status,
      req.body.total_quantity,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//ข้อมูลการจองคิว
app.get('/allreserves', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `reserves` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูลการจองคิว ตาม id
app.get('/reserve/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `reserves` ' + 
    ' WHERE `reserve_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลการจองคิว
app.put('/updatereserve/:id', function (req, res, next) {
  const id = req.params.id;
  const user_id = req.body.user_id;
  const description = req.body.description;
  const company_id = req.body.company_id;
  const car_id = req.body.car_id;
  const driver_id = req.body.driver_id;
  const status = req.body.status;
  const total_quantity = req.body.total_quantity;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `reserves` ' + 
    ' SET `user_id` = ?, ' + 
    ' `description` = ?,' + 
    ' `company_id` = ?,' + 
    ' `car_id` = ?,' + 
    ' `driver_id` = ?,' +
    ' `status` = ?,' +
    ' `total_quantity` = ?,' +
    ' `updated_at` = ? ' + 
    ' WHERE `reserve_id` = ? ', 
    [ user_id, 
      description,
      company_id,
      car_id,
      driver_id,
      status,
      total_quantity,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลการจองคิว
app.delete('/deletereserve/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `reserves` ' + 
    ' WHERE `reserve_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# ข้อมูลคิว table: queues
//# ---------------------------------------------

//เพิ่มข้อมูลคิว
app.post('/addqueue', function (req, res, next) {
  connection.execute(
    'INSERT INTO `queues` ' +
    '(`reserve_id`,`token`,`description`,' +
    '`created_at`,`updated_at`)' +
    ' VALUES (?,?,?,?,?)',
    [ req.body.reserve_id, 
      req.body.token,
      req.body.description,
      req.body.created_at,
      req.body.updated_at],
    function(err) {
      if (err) {
        res.json({status: 'error', message: err})
        return
      }
      res.json({status: "ok"});
    }
  );
})

//ข้อมูลคิว
app.get('/allqueues', function (req, res, next) {
  connection.query(
    ' SELECT * ' + 
    ' FROM `queues` ' , 
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//ข้อมูลคิว ตาม id
app.get('/queue/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT * ' + 
    ' FROM `queues` ' + 
    ' WHERE `queue_id` = ?', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err})
        return;
      }
      res.json(results);
    }
  );
})

//อัปเดทข้อมูลคิว
app.put('/updatequeue/:id', function (req, res, next) {
  const id = req.params.id;
  const reserve_id = req.body.reserve_id;
  const token = req.body.token;
  const description = req.body.description;
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `queues` ' + 
    ' SET `reserve_id` = ?, ' + 
    ' `token` = ?,' + 
    ' `description` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `queue_id` = ? ', 
    [ reserve_id, 
      token,
      description,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//ลบข้อมูลคิว
app.delete('/deletequeue/:id', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' DELETE FROM `queues` ' + 
    ' WHERE `queue_id` = ? ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step1 status = "waiting"
//# ---------------------------------------------

app.get('/step1waiting', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 1 and status = "waiting" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step1 staus = "processing"
//# ---------------------------------------------

app.get('/step1processing', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 1 and status = "processing" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step2 status = "waiting"
//# ---------------------------------------------

app.get('/step2waiting', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 2 and status = "waiting" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step2 status = "processing"
//# ---------------------------------------------

app.get('/step2processing', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 2 and status = "processing" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step3 status = "waiting"
//# ---------------------------------------------

app.get('/step3waiting', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 3 and status = "waiting" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step3 status = "processing"
//# ---------------------------------------------

app.get('/step3processing', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 3 and status = "processing" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step4 status = "waiting"
//# ---------------------------------------------

app.get('/step4waiting', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 3 and status = "waiting" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# Step4 status = "processing"
//# ---------------------------------------------
app.get('/step4processing', function (req, res, next) {
  const id = req.params.id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' +
    ' WHERE s.order = 4 and status = "processing" ', 
    [id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# StepAll
//# step_order = ลำดับกลุ่มสถานี, 
//# step_status = สถานะ (none, waiting, processing, completed)
//# ---------------------------------------------

app.get('/stepcount/:step_order/:step_status', function (req, res, next) {
  const step_order =  req.params.step_order
  const step_status = req.params.step_status;
  connection.query(
    ' SELECT count(*) as step_count ' + 
    ' FROM `steps` AS s ' + 
    ' JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' WHERE s.order = ? and s.status = ? ', 
    [step_order, step_status],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# StepAll
//# Step by step_order & queue_id
//# ---------------------------------------------

app.get('/stepbyqueueid/:step_order/:queue_id', function (req, res, next) {
  const step_order = req.params.step_order;
  const queue_id = req.params.queue_id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s ' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' + 
    ' WHERE s.order = ? and q.queue_id = ?', 
    [step_order,queue_id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# List all step by queue_id
//# ---------------------------------------------

app.get('/stepbyqueueidonly/:queues_id', function (req, res, next) {
  const queues_id = req.params.queues_id;
  connection.query(
    ' SELECT *' + 
    ' FROM `steps` AS s ' + 
    ' INNER JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' LEFT JOIN stations AS st ON s.station_id = st.station_id ' + 
    ' WHERE q.queue_id = ?', 
    [queues_id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# จำนวนคิวตาม queue_id และ สถานะของ step 
//# status (none, waiting, processing, completed)
//# ---------------------------------------------

app.get('/queuecount/:queue_id/:step_status', function (req, res, next) {
  const queue_id =  req.params.queue_id
  const step_status = req.params.step_status;
  connection.query(
    ' SELECT count(*) as queues_count ' + 
    ' FROM `steps` AS s' + 
    ' JOIN queues AS q ON s.queue_id = q.queue_id ' + 
    ' WHERE s.queue_id = ? and status = ? ', 
    [queue_id, step_status],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json(results);
    }
  );
})

//# ---------------------------------------------
//# อัปเดทข้อมูลลำดับการให้บริการ
//# status (none, waiting, processing, completed)
//# station_id = สถานี
//# ---------------------------------------------
app.put('/updatestepstatus/:id', function (req, res, next) {
  const id = req.params.id;
  const steps_status = req.body.status;
  const steps_stations_id = req.body.station_id
  const updated_at = req.body.updated_at;
  connection.query(
    ' UPDATE `steps` ' + 
    ' SET `status` = ?, ' + 
    ' `station_id` = ?,' + 
    ' `updated_at` = ? ' + 
    ' WHERE `step_id` = ? ', 
    [ steps_status,
      steps_stations_id,
      updated_at,
      id],
    function(err, results) {
      if (err) {
        res.json({ status: 'error', message: err});
        return;
      }
      res.json({status: "ok"});
    }
  );
})

//
app.listen(5005, function () {
  console.log('CORS-enabled web server listening on port 5005')
})