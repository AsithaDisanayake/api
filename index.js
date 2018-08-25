var http = require("http");
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mysql = require("mysql");
const JSON = require("circular-json");
var fs = require("fs");

const jsonWebToken = require("jsonwebtoken");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.por || 3000;
var router = express.Router();
const myJWTSecretKey = "my-secret-key";

var con = mysql.createConnection({
  host: "localhost", //mysql database host name
  user: "root", //mysql database user name
  password: "", //mysql database password
  database: "handisale"
});
con.connect(function(err) {
  if (err) throw err;
  console.log("You are now connected with mysql database...");
});

var pdata = {
  Data: ""
};

app.post("/login", function(req, res) {
  var email = req.body.email;
  var pass = req.body.password;

  con.query(
    "SELECT * from sales_person WHERE salesperson_username=? and salesperson_password=? LIMIT 1",
    [email, pass],
    function(err, rows, fields) {
      if (rows.length != 0) {
        // data["Data"] = "Successfully logged in..";
        //res.json(data);

        const user = {
          un: email,
          pw: pass
        };
        pdata["Data"] = rows;

        // sign with default (HMAC SHA256)
        const token = jsonWebToken.sign(user, myJWTSecretKey);
        res.json({
          error: false,
          token: token,
          message: "Successfully logged in",
          data: rows
        });

        // con.end()
      } else {
        pdata["Data"] = "Email or password is incorrect.";
        res.json(pdata);
      }
    }
  );
});

app.get("/", function(req, res) {
  res.json({
    error: true,
    data: "Welcome"
  });
});

app.get("/prods", function(req, res) {
  let token = con.escape(req.headers.authorization);

  if (!token) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide token" });
  }
  if (req.accepts("json")) {
    if (isValidToken(token)) {
      con.query(
        "SELECT a.name as product_name,sum(b.order_items_qty) as product_quantity FROM product as a,sales_person_items as b where a.idproduct=b.product_idproduct  Group By a.name",
        function(error, results, fields) {
          if (error) throw error;
          if (results.length > 0)
            return res.send({
              error: false,
              data: results,
              message: "Products list"
            });
          else
            return res.send({
              error: true,
              data: results,
              message: "Product list is empty"
            });
        }
      );
    } else {
      res.json({
        error: true,
        data: "Invalid Token"
      });
    }
  }
});

function ensureToken(req, res, next) {
  const bearerHeader = req.headers["authorization"];

  if (!bearerHeader) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide token" });
  }

  if (typeof bearerHeader !== "undefined") {
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];
    req.token = bearerToken;
    next();
  } else {
    res.sendStatus(403);
  }
}

app.get("/product", function(req, res) {
  if (false) {
    res.sendStatus(403);
  } else {
    var prodata = pdata["Data"];
    var salep = prodata[0];
    var salep_id = 3;
    var measure_unit_name;
    var product_cat_name;
    var measure;

    // mysql query
    con.query(
      "SELECT * FROM sales_person_items where sales_person_idsales_person =?",
      [salep_id],
      function(error, results, fields) {
        if (error) throw error;
        if (results.length > 0) {
          var product_results = {
            code: "",
            name: "",
            qty: "",
            price: "",
            category: "",
            measure: ""
          };
          var content = [];
          step(0);
          function step(j) {
            if (j < results.length) {
              var sales_person_items = results[j];
              var order_items_qty = sales_person_items["order_items_qty"];
              var product_id = sales_person_items["product_idproduct"];

              con.query(
                "SELECT * from (SELECT warehouse_has_product.product_code,warehouse_has_product.product_code_count, warehouse_has_product.unit_price, warehouse_has_product.measure_unit_idmeasure_unit, product.name, warehouse_has_product.idproduct from warehouse_has_product INNER JOIN product ON warehouse_has_product.idproduct = product.idproduct where warehouse_has_product.idproduct =? LIMIT 1) AS t INNER JOIN measure_unit ON t.measure_unit_idmeasure_unit = measure_unit.idmeasure_unit ",
                [product_id],
                function(error, result1, fields) {
                  if (error) throw error;
                  if (result1.length > 0) {
                    var product_detail = result1[0];
                    var code =
                      product_detail["product_code"] +
                      product_detail["product_code_count"] +
                      "";
                    //+ product_detail["product_code_count "]+ ""
                    var unit_price = product_detail["unit_price"];
                    let product_cat_id =
                      product_detail["product_cat_idproduct_cat"];
                    let measure_unit_id =
                      product_detail["measure_unit_idmeasure_unit"];
                    let product_name = product_detail["name"];

                    measure = product_detail["unit_name"];

                    var obj = [
                      {
                        code: code,
                        name: product_name,
                        qty: order_items_qty,
                        price: unit_price,
                        category: product_cat_name,
                        measure: measure
                      }
                    ];

                    content.push(obj);
                    obj = null;
                    step(j + 1);
                  } else {
                    return res.send({
                      error: true,
                      data: result,
                      message: "Product "
                    });
                  }
                }
              );
            } else {
              return res.send({
                error: false,
                data: content,
                message: "success"
              });
              console.log(content);
            }
          }
        } else {
          return res.send({ error: true, data: results, message: "empty" });
        }
      }
    );
  }
});

app.get("/customer", ensureToken, function(req, res) {
  jsonWebToken.verify(req.token, myJWTSecretKey, function(err, data) {
    if (err) {
      res.sendStatus(403);
    } else {
      var prodata = pdata["Data"];
      var salep = prodata[0];
      var company_id = salep["company_idcompany"];

      con.query(
        "select * from customer  where company_idcompany=? ",
        [company_id],
        function(error, results, fields) {
          if (error) throw error;
          else {
            return res.send({
              error: false,
              data: results,
              message: "success"
            });
            // res.send(error:false,data:(JSON.stringify(results)),);
          }
        }
      );
    }
  });
});

app.get("/receipt", ensureToken, function(req, res) {
  jsonWebToken.verify(req.token, myJWTSecretKey, function(err, data) {
    if (err) {
      res.sendStatus(403);
    } else {
      var prodata = pdata["Data"];
      var salep = prodata[0];
      var salep_id = salep["idsales_person"];

      con.query(
        "select * from receipt INNER JOIN (select sale.sales_person_idsales_person , sale.customer_idcustomer , sale.idsale , customer.customer_name from sale INNER JOIN customer ON customer.idcustomer =sale.customer_idcustomer  where  sale.sales_person_idsales_person=?)As salp ON salp.idsale =receipt.sale_idsale ",
        [salep_id],
        function(error, results, fields) {
          if (error) throw error;
          else {
            return res.send({
              error: false,
              data: results,
              message: "success"
            });
            // res.send(error:false,data:(JSON.stringify(results)),);
          }
        }
      );
    }
  });
});

app.get("/advance", ensureToken, function(req, res) {
  jsonWebToken.verify(req.token, myJWTSecretKey, function(err, data) {
    if (err) {
      res.sendStatus(403);
    } else {
      var prodata = pdata["Data"];
      var salep = prodata[0];
      var salep_id = salep["idsales_person"];

      con.query(
        "select * from advance INNER JOIN (SELECT order_product.customer_idcustomer,order_product.order_code,order_product.order_code_count,order_product.idorder,customer.idcustomer,customer.customer_name,customer.city FROM order_product INNER JOIN customer ON  customer.idcustomer =  order_product.customer_idcustomer)As sal ON sal.idorder =advance.order_product_idorder WHERE advance.sales_person_idsales_person=?",
        [salep_id],
        function(error, results, fields) {
          if (error) throw error;
          else {
            return res.send({
              error: false,
              data: results,
              message: "success"
            });
            // res.send(error:false,data:(JSON.stringify(results)),);
          }
        }
      );
    }
  });
});

app.get("/discount", function(req, res) {
  if (false) {
    res.sendStatus(403);
  } else {
    // var prodata = pdata["Data"];
    // var salep = prodata[0];
    var salep_id = 3;

    // mysql query
    con.query(
      "SELECT * FROM sale INNER JOIN customer ON customer.idcustomer = sale.customer_idcustomer where sales_person_idsales_person =?",
      [salep_id],
      function(error, results, fields) {
       // console.log(results);
        if (error) throw error;
        if (results.length > 0) {
          // var product_results = {
          //   code: "",
          //   name: "",
          //   qty: "",
          //   price: "",
          //   category: "",
          //   measure: ""
          // };
          var content = [];

          step(0);
          function step(j) {
            if (j < results.length) {
              sale_items = results[j];
              var sale_id = sale_items["idsale"];
              content.push(results[j]);
              
              con.query(
                "SELECT * from sales_item INNER JOIN (SELECT warehouse_has_product.unit_price, product.name, warehouse_has_product.idproduct from warehouse_has_product INNER JOIN product ON warehouse_has_product.idproduct = product.idproduct ) AS t ON t.idproduct = sales_item.product_idproduct where sales_item.sale_idsale =?",
                [sale_id],
                function(error, result1, fields) {
                  if (error) throw error;
                  if (result1.length > 0) {
                    var sale_items = result1[0];

                    let product_name = sale_items["name"];
                    var unit_price = sale_items["unit_price"];
                    let sales_item_qty = sale_items["sales_item_qty"];
                    let item_sales_value = sales_item_qty * unit_price;
                    let item_discount_qty = sale_items["item_discount_qty"];
                    let item_discount_rupees =
                      sale_items["item_discount_rupees"];
                    let item_discount_prsntge =
                      sale_items["item_discount_prsntge"];

                    var obj = [
                      {
                        name: product_name,
                        qty: sales_item_qty,
                        price: unit_price,
                        item_sales_value: item_sales_value,
                        item_discount_qty: item_discount_qty,
                        item_discount_rupees: item_discount_rupees,
                        item_discount_prsntge: item_discount_prsntge
                      }
                    ];

                    content.push(obj);
                    obj = null;
                    step(j + 1);
                  } else {
                    return res.send({
                      error: true,
                      data: results,
                      message: "Discount"
                    });
                  }
                }
              );
            } else {
              return res.send({
                error: false,
                data: content,
                message: "Discount"
              });
              console.log(content);
            }
          }
        } else {
          return res.send({ error: true, data: results, message: "empty" });
        }
      }
    );
  }
});

function isValidToken(token) {
  try {
    const tokenDecodedData = jsonWebToken.verify(token, myJWTSecretKey);
    return true;
  } catch (error) {
    return false;
  }
}

// GET - http://localhost:3000/verify/{token}
app.get("/verify/:token", (req, res) => {
  try {
    const tokenDecodedData = jsonWebToken.verify(
      req.params.token,
      myJWTSecretKey
    );
    return res.json({
      error: false,
      data: tokenDecodedData
    });
  } catch (error) {
    res.json({
      error: true,
      data: error
    });
  }
});

app.listen(port, function() {
  console.log("Express server running on port %d", port);
});
