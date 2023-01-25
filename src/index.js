'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _dbConfig = require('./config/dbConfig.js');

var _products = require('./routes/products.js');

var _expressHandlebars = require('express-handlebars');

var _expressHandlebars2 = _interopRequireDefault(_expressHandlebars);

var _socket = require('socket.io');

var _normalizr = require('normalizr');

var _faker = require('@faker-js/faker');

var _contenedorProductos = require('./managers/contenedorProductos.js');

var _contenedorChat = require('./managers/contenedorChat.js');

var _contenedorSql = require('./managers/contenedorSql.js');

var _expressSession = require('express-session');

var _expressSession2 = _interopRequireDefault(_expressSession);

var _cookieParser = require('cookie-parser');

var _cookieParser2 = _interopRequireDefault(_cookieParser);

var _connectMongo = require('connect-mongo');

var _connectMongo2 = _interopRequireDefault(_connectMongo);

var _passport = require('passport');

var _passport2 = _interopRequireDefault(_passport);

var _passportLocal = require('passport-local');

var _bcrypt = require('bcrypt');

var _bcrypt2 = _interopRequireDefault(_bcrypt);

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _user = require('./models/user.js');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _url = require('url');

var _config = require('./config/config.js');

var _yargs = require('yargs');

var _yargs2 = _interopRequireDefault(_yargs);

var _child_process = require('child_process');

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

//CANTIDAD DE CPUS

var numeroCPUs = _os2.default.cpus().length;

var args = (0, _yargs2.default)(process.argv.slice(2));

var objArgumentos = args.default({
    p: 8080,
    m: "FORK"
}).alias({
    p: "puerto",
    m: "mode"
}).argv;

console.log(objArgumentos.p);

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename);


var mongoUrl = _config.config.mongoUrl;
var clave = _config.config.clave;
var mongoUrlSessions = _config.config.mongoUrlSessions;

_mongoose2.default.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (error) {
    if (error) return console.log('Hubo un error conectandose a la base ' + error);
    console.log("Conexion exitosa");
});

var app = (0, _express2.default)();
app.use(_express2.default.json());
app.use(_express2.default.urlencoded({ extended: true }));
app.use(_express2.default.static(__dirname + '/public'));

//configuracion template engine handlebars
app.engine('handlebars', _expressHandlebars2.default.engine());
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

app.use((0, _expressSession2.default)({
    store: _connectMongo2.default.create({
        mongoUrl: mongoUrlSessions
    }),
    secret: clave,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 600000
    }
}));

app.use((0, _cookieParser2.default)());

app.use(_passport2.default.initialize());
app.use(_passport2.default.session());

_passport2.default.serializeUser(function (user, done) {
    done(null, user.id);
});

_passport2.default.deserializeUser(function (id, done) {
    _user.UserModel.findById(id, function (err, userFound) {
        return done(err, userFound);
    });
});

var createHash = function createHash(password) {
    var hash = _bcrypt2.default.hashSync(password, _bcrypt2.default.genSaltSync(10));
    return hash;
};

_passport2.default.use("signupStrategy", new _passportLocal.Strategy({
    passReqToCallback: true,
    usernameField: "email"
}, function (req, username, password, done) {
    _user.UserModel.findOne({ username: username }, function (error, userFound) {
        if (error) return done(error, null, { message: "Hubo un error" });
        if (userFound) return done(null, null, { message: "El usuario ya existe" });
        var newUser = {
            name: req.body.name,
            username: username,
            password: createHash(password)
        };
        _user.UserModel.create(newUser, function (error, userCreated) {
            if (error) return done(error, null, { message: "Error al registrar el usuario" });
            return done(null, userCreated);
        });
    });
}));

_passport2.default.use("loginStrategy", new _passportLocal.Strategy({
    usernameField: "email"
}, function (username, password, done) {
    _user.UserModel.findOne({ username: username }, function (error, userFound) {
        if (error) return done(error, null, { message: "Hubo un error" });
        if (!userFound) return done(null, null, { message: "Error este usuario no existe" });
        var igual = _bcrypt2.default.compareSync(password, userFound.password);
        console.log(igual);
        if (!igual) {
            return done(null, null, { message: "Contraseña incorrecta" });
        }
        return done(null, userFound);
    });
}));

var commerce = _faker.faker.commerce,
    image = _faker.faker.image;
//service
// const productosApi = new Contenedor("productos.txt");

var productosApi = new _contenedorSql.ContenedorMysql(_dbConfig.options.mariaDB, "products");
var chatApi = new _contenedorChat.ContenedorChat("chat.txt");
// const chatApi = new ContenedorSql(options.sqliteDB,"chat");


//normalizacion
//creamos los esquemas.
//esquema del author
var authorSchema = new _normalizr.schema.Entity("authors", {}, { idAttribute: "email" });

//esquema mensaje
var messageSchema = new _normalizr.schema.Entity("messages", { author: authorSchema });

//creamos nuevo objeto para normalizar la informacion
// {
//     id:"chatHistory",
//     messages:[
//         {},{},{}
//     ]
// }
//esquema global para el nuevo objeto
var chatSchema = new _normalizr.schema.Entity("chat", {
    messages: [messageSchema]
}, { idAttribute: "id" });

//aplicar la normalizacion
//crear una funcion que la podemos llamar para normalizar la data
var normalizarData = function normalizarData(data) {
    var normalizeData = (0, _normalizr.normalize)({ id: "chatHistory", messages: data }, chatSchema);
    return normalizeData;
};

var normalizarMensajes = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var results, messagesNormalized;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return chatApi.getAll();

                    case 2:
                        results = _context.sent;
                        messagesNormalized = normalizarData(results);
                        // console.log(JSON.stringify(messagesNormalized, null,"\t"));

                        return _context.abrupt('return', messagesNormalized);

                    case 5:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, undefined);
    }));

    return function normalizarMensajes() {
        return _ref.apply(this, arguments);
    };
}();

var randomProducts = function randomProducts() {
    var products = [];
    for (var i = 0; i < 5; i++) {
        products.push({
            title: commerce.product(),
            price: commerce.price(),
            thumbnail: image.imageUrl()
        });
    }
    return products;
};
var calcularPorcentaje = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var chat, normal, result;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.next = 2;
                        return chatApi.getAll();

                    case 2:
                        chat = _context2.sent;
                        _context2.next = 5;
                        return normalizarMensajes();

                    case 5:
                        normal = _context2.sent;
                        result = 100 - Math.round(JSON.stringify(normal).length / JSON.stringify(chat).length * 100);

                        console.log(JSON.stringify(chat).length, JSON.stringify(normal).length);
                        return _context2.abrupt('return', result);

                    case 9:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, undefined);
    }));

    return function calcularPorcentaje() {
        return _ref2.apply(this, arguments);
    };
}();

// // Verificar login
// const checkUserLogged = (req,res,next)=>{
//     if(req.session.username){
//         next();
//     } else{
//         res.redirect("/login");
//     }
// }
// Login


// routes
//view routes
app.get('/', function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(req, res) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        console.log(req.session);

                        if (!req.isAuthenticated()) {
                            _context3.next = 10;
                            break;
                        }

                        _context3.t0 = res;
                        _context3.next = 5;
                        return calcularPorcentaje();

                    case 5:
                        _context3.t1 = _context3.sent;
                        _context3.t2 = {
                            porcentaje: _context3.t1
                        };

                        _context3.t0.render.call(_context3.t0, 'home', _context3.t2);

                        _context3.next = 11;
                        break;

                    case 10:
                        res.send("<div>Debes <a href='/login'>inciar sesion</a> o <a href='/signup'>registrarte</a></div>");

                    case 11:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, undefined);
    }));

    return function (_x, _x2) {
        return _ref3.apply(this, arguments);
    };
}());

app.get('/productos', function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(req, res) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.t0 = res;
                        _context4.next = 3;
                        return productosApi.getAll();

                    case 3:
                        _context4.t1 = _context4.sent;
                        _context4.t2 = {
                            products: _context4.t1
                        };

                        _context4.t0.render.call(_context4.t0, 'products', _context4.t2);

                    case 6:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, undefined);
    }));

    return function (_x3, _x4) {
        return _ref4.apply(this, arguments);
    };
}());

app.get("/api/productos-test", function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(req, res) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        res.render('products', {
                            products: randomProducts()
                        });

                    case 1:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, undefined);
    }));

    return function (_x5, _x6) {
        return _ref5.apply(this, arguments);
    };
}());

//api routes
app.use('/api/products', _products.router);

app.get("/signup", function (req, res) {
    var errorMessage = req.session.messages ? req.session.messages[0] : '';
    res.render("signup", { error: errorMessage });
    req.session.messages = [];
});

app.get("/login", function (req, res) {
    var errorMessage = req.session.messages ? req.session.messages[0] : '';
    res.render("login", { error: errorMessage });
    req.session.messages = [];
});

app.post("/signup", _passport2.default.authenticate("signupStrategy", {
    failureRedirect: "/signup",
    failureMessage: true
}), function (req, res) {
    res.redirect("/");
});

app.post("/login", _passport2.default.authenticate("loginStrategy", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureMessage: true
}));

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/login");
});

// RUTA INFO
app.get("/info", function (req, res) {
    res.send({
        argumentos: process.argv,
        plataforma: process.plataform,
        versionNode: process.versions.node,
        rss: process.memoryUsage.rss(),
        path: process.env.npm_execpath,
        processID: process.pid,
        carpetaProyecto: process.env.path,
        numeroCPUs: numeroCPUs
    });
});

// FORK

app.get("/api/random/:cant", function (req, res) {
    var cant = req.params.cant;
    var child = (0, _child_process.fork)("src/child.js");
    child.on("message", function (childMsg) {
        if (childMsg === "listo") {
            child.send(cant);
        } else {
            res.json({ resultado: childMsg });
        }
    });
});

//Cluster
var MODO = objArgumentos.m;
if (MODO === "CLUSTER" && _cluster2.default.isPrimary) {
    var numCPUS = _os2.default.cpus().length;
    for (var i = 0; i < numCPUS; i++) {
        _cluster2.default.fork();
    }
    _cluster2.default.on("exit", function (worker) {
        console.log('El subproceso ' + worker.process.pid + ' fallo');
        _cluster2.default.fork();
    });
} else {
    //express server
    var server = app.listen(objArgumentos.p, function () {
        console.log('Escuchando en puerto ' + objArgumentos.p);
    });

    //websocket server
    var io = new _socket.Server(server);

    //configuracion websocket
    io.on("connection", function () {
        var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(socket) {
            return regeneratorRuntime.wrap(function _callee8$(_context8) {
                while (1) {
                    switch (_context8.prev = _context8.next) {
                        case 0:
                            _context8.t0 = io.sockets;
                            _context8.next = 3;
                            return productosApi.getAll();

                        case 3:
                            _context8.t1 = _context8.sent;

                            _context8.t0.emit.call(_context8.t0, "products", _context8.t1);

                            //recibimos el producto nuevo del cliente y lo guardamos con filesystem
                            socket.on("newProduct", function () {
                                var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(data) {
                                    return regeneratorRuntime.wrap(function _callee6$(_context6) {
                                        while (1) {
                                            switch (_context6.prev = _context6.next) {
                                                case 0:
                                                    _context6.next = 2;
                                                    return productosApi.save(data);

                                                case 2:
                                                    _context6.t0 = io.sockets;
                                                    _context6.next = 5;
                                                    return productosApi.getAll();

                                                case 5:
                                                    _context6.t1 = _context6.sent;

                                                    _context6.t0.emit.call(_context6.t0, "products", _context6.t1);

                                                case 7:
                                                case 'end':
                                                    return _context6.stop();
                                            }
                                        }
                                    }, _callee6, undefined);
                                }));

                                return function (_x8) {
                                    return _ref7.apply(this, arguments);
                                };
                            }());

                            //CHAT
                            //Envio de todos los mensajes al socket que se conecta.
                            _context8.t2 = io.sockets;
                            _context8.next = 9;
                            return normalizarMensajes();

                        case 9:
                            _context8.t3 = _context8.sent;

                            _context8.t2.emit.call(_context8.t2, "messages", _context8.t3);

                            //recibimos el mensaje del usuario y lo guardamos en el archivo chat.txt
                            socket.on("newMessage", function () {
                                var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(newMsg) {
                                    return regeneratorRuntime.wrap(function _callee7$(_context7) {
                                        while (1) {
                                            switch (_context7.prev = _context7.next) {
                                                case 0:
                                                    console.log(newMsg);
                                                    _context7.next = 3;
                                                    return chatApi.save(newMsg);

                                                case 3:
                                                    _context7.t0 = io.sockets;
                                                    _context7.next = 6;
                                                    return normalizarMensajes();

                                                case 6:
                                                    _context7.t1 = _context7.sent;

                                                    _context7.t0.emit.call(_context7.t0, "messages", _context7.t1);

                                                case 8:
                                                case 'end':
                                                    return _context7.stop();
                                            }
                                        }
                                    }, _callee7, undefined);
                                }));

                                return function (_x9) {
                                    return _ref8.apply(this, arguments);
                                };
                            }());

                        case 12:
                        case 'end':
                            return _context8.stop();
                    }
                }
            }, _callee8, undefined);
        }));

        return function (_x7) {
            return _ref6.apply(this, arguments);
        };
    }());
}
