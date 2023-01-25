import express from 'express';
import {options} from "./config/dbConfig.js";
import {router} from './routes/products.js';
import handlebars from 'express-handlebars';
import {Server} from "socket.io";
import {normalize, schema} from "normalizr";
import {faker} from "@faker-js/faker"
import {Contenedor} from "./managers/contenedorProductos.js";
import {ContenedorChat} from './managers/contenedorChat.js';
import {ContenedorMysql} from "./managers/contenedorSql.js"
import session  from 'express-session';
import cookieParser from "cookie-parser"
import mongoStore from "connect-mongo";
import passport from "passport"
import {Strategy as localStrategy} from "passport-local"
import bcrypt from "bcrypt"
import mongosee from "mongoose"
import { UserModel } from './models/user.js';
import path from 'path';
import { fileURLToPath} from "url";
import {config} from "./config/config.js"
import Yargs from 'yargs';
import { fork } from 'child_process';
import os from "os"
import cluster from 'cluster';
import { logger } from './logger.js';
import compression from 'compression';

//CANTIDAD DE CPUS

const numeroCPUs = os.cpus().length

const args = Yargs(process.argv.slice(2))

const objArgumentos = args.default({
    p:8080,
    m: "FORK"
})
.alias({
    p:"puerto",
    m:"mode"
}).argv

console.log(objArgumentos.p)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename);


const mongoUrl = config.mongoUrl
const clave = config.clave
const mongoUrlSessions = config.mongoUrlSessions

mongosee.connect(mongoUrl,{
    useNewUrlParser: true,
    useUnifiedTopology: true
},(error)=>{
    if (error) return console.log(`Hubo un error conectandose a la base ${error}`)
    console.log("Conexion exitosa")
})

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}))
app.use(express.static(__dirname+'/public'))

//configuracion template engine handlebars
app.engine('handlebars', handlebars.engine());
app.set('views', __dirname+'/views');
app.set('view engine', 'handlebars');

//COMPRESSION

app.use(compression())

app.use(session({
    store: mongoStore.create({
        mongoUrl: mongoUrlSessions
    }),
    secret: clave,
    resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge:600000
    }
}))

 app.use(cookieParser())

app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser((user,done)=>{
    done(null, user.id)
});


passport.deserializeUser((id,done)=>{
    UserModel.findById(id,(err, userFound)=>{
        return done(err, userFound)
    })
});

const createHash = (password)=>{
    const hash = bcrypt.hashSync(password,bcrypt.genSaltSync(10));
    return hash;
}

passport.use("signupStrategy", new localStrategy(
    {
        passReqToCallback: true,
        usernameField: "email",
    },
    (req,username,password,done)=>{
        UserModel.findOne({username:username},(error,userFound)=>{
            if(error) return done(error,null,{message:"Hubo un error"})
            if(userFound) return done(null,null,{message:"El usuario ya existe"})
            const newUser ={
                name:req.body.name,
                username:username,
                password:createHash(password)
            }
            UserModel.create(newUser,(error, userCreated)=>{
                if(error) return done(error,null,{message:"Error al registrar el usuario"})
                return done(null,userCreated)
            })
        })
    }
))

passport.use("loginStrategy", new localStrategy(
    {
        usernameField: "email"
    },
    (username,password,done)=>{
        UserModel.findOne({username:username},(error,userFound)=>{
            if(error) return done(error,null,{message:"Hubo un error"})
            if (!userFound) return done(null,null,{message:"Error este usuario no existe"})
            const igual = bcrypt.compareSync(password, userFound.password)
            console.log(igual)
            if(!igual){
                return done(null,null,{message:"Contraseña incorrecta"})
            }
            return done(null,userFound)
        })
    }
))

const {commerce, image} = faker
//service
// const productosApi = new Contenedor("productos.txt");
const productosApi = new ContenedorMysql(options.mariaDB, "products");
const chatApi = new ContenedorChat("chat.txt");
// const chatApi = new ContenedorSql(options.sqliteDB,"chat");



//normalizacion
//creamos los esquemas.
//esquema del author
const authorSchema = new schema.Entity("authors",{}, {idAttribute:"email"});

//esquema mensaje
const messageSchema = new schema.Entity("messages", {author: authorSchema});

//creamos nuevo objeto para normalizar la informacion
// {
//     id:"chatHistory",
//     messages:[
//         {},{},{}
//     ]
// }
//esquema global para el nuevo objeto
const chatSchema = new schema.Entity("chat", {
    messages:[messageSchema]
}, {idAttribute:"id"});

//aplicar la normalizacion
//crear una funcion que la podemos llamar para normalizar la data
const normalizarData = (data)=>{
    const normalizeData = normalize({id:"chatHistory", messages:data}, chatSchema);
    return normalizeData;
};

const normalizarMensajes = async()=>{
    const results = await chatApi.getAll();
    const messagesNormalized = normalizarData(results);
    // console.log(JSON.stringify(messagesNormalized, null,"\t"));
    return messagesNormalized;
}

const randomProducts = ()=>{
    let products = []
    for(let i=0;i<5;i++){
        products.push({
            title:commerce.product(),
            price:commerce.price(),
            thumbnail:image.imageUrl()
        })
    }
    return products
}
const calcularPorcentaje = async()=>{
    const chat = await chatApi.getAll()
    const normal = await normalizarMensajes()
    const result = 100 - Math.round((JSON.stringify(normal).length / JSON.stringify(chat).length) * 100)
    console.log(JSON.stringify(chat).length,JSON.stringify(normal).length)
    return result
}


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
app.get('/', async(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    if(req.isAuthenticated()){
        res.render('home',{porcentaje: await calcularPorcentaje()})
    } else{
        res.send("<div>Debes <a href='/login'>inciar sesion</a> o <a href='/signup'>registrarte</a></div>")
    }
})

app.get('/productos', async(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    res.render('products',{products: await productosApi.getAll()})
})

app.get("/api/productos-test",async(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    res.render('products',{
        products: randomProducts()
    })
})


//api routes
app.use('/api/products',router)

app.get("/signup", (req, res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    const errorMessage = req.session.messages ? req.session.messages[0] : '';
    res.render("signup", {error:errorMessage});
    req.session.messages = [];
})

app.get("/login",(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    const errorMessage = req.session.messages ? req.session.messages[0] : '';
    res.render("login", {error:errorMessage});
    req.session.messages = [];
})

app.post("/signup",passport.authenticate("signupStrategy",{
    failureRedirect:"/signup",
    failureMessage:true
}),(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    res.redirect("/")
})

app.post("/login",passport.authenticate("loginStrategy",{
    successRedirect:"/",
    failureRedirect:"/login",
    failureMessage:true
}),(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
})


app.get("/logout",(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    req.session.destroy()
    res.redirect("/login")
})

// RUTA INFO
app.get("/info",(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
    // console.log({argumentos: process.argv,
    //     plataforma: process.plataform,
    //     versionNode: process.versions.node,
    //     rss: process.memoryUsage.rss(),
    //     path: process.env.npm_execpath,
    //     processID: process.pid,
    //     carpetaProyecto: process.env.path,
    //     numeroCPUs: numeroCPUs})
    res.send({
        argumentos: process.argv,
        plataforma: process.plataform,
        versionNode: process.versions.node,
        rss: process.memoryUsage.rss(),
        path: process.env.npm_execpath,
        processID: process.pid,
        carpetaProyecto: process.env.path,
        numeroCPUs: numeroCPUs
    })
})

// FORK

// app.get("/api/random/:cant",(req,res)=>{
//     const ruta = req.path
//     const metodo = req.method
//     logger.info(`Ruta: ${ruta} y metodo: ${metodo}`)
//     const cant = req.params.cant
//     const child = fork("src/child.js")
//     child.on("message",(childMsg)=>{
//         if(childMsg === "listo"){
//             child.send(cant)
//         } else{
//             res.json({resultado: childMsg})
//         }
//     })
    
// })

app.get("*",(req,res)=>{
    const ruta = req.path
    const metodo = req.method
    logger.warning(`Ruta: ${ruta} y metodo: ${metodo} incorrectos`)
    res.send(`Ruta: ${ruta} no es valida`)
})




//Cluster
const MODO = objArgumentos.m
if(MODO === "CLUSTER" && cluster.isPrimary){
    const numCPUS = os.cpus().length
    for(let i=0; i<numCPUS; i++){
        cluster.fork()
    }
    cluster.on("exit",(worker)=>{
        console.log (`El subproceso ${worker.process.pid} fallo`)
        cluster.fork()
    })
}else{
    //express server
    const PORT = process.env.PORT || 8080
    app.listen(PORT,()=>console.log(`Escuchando en puerto ${PORT}`))









    //websocket server
    const io = new Server(server);

    //configuracion websocket
    io.on("connection",async(socket)=>{
        //PRODUCTOS
        //envio de los productos al socket que se conecta.
        io.sockets.emit("products", await productosApi.getAll())

        //recibimos el producto nuevo del cliente y lo guardamos con filesystem
        socket.on("newProduct",async(data)=>{
            await productosApi.save(data);
            //despues de guardar un nuevo producto, enviamos el listado de productos actualizado a todos los sockets conectados
            io.sockets.emit("products", await productosApi.getAll())
        })

        //CHAT
        //Envio de todos los mensajes al socket que se conecta.
        io.sockets.emit("messages", await normalizarMensajes());

        //recibimos el mensaje del usuario y lo guardamos en el archivo chat.txt
        socket.on("newMessage", async(newMsg)=>{
            console.log(newMsg);
            await chatApi.save(newMsg);
            io.sockets.emit("messages", await normalizarMensajes());
        });
    })
}