import log4js from "log4js";
import { envConfig } from "./envConfig.js";

//configuracion de log4js
log4js.configure({
    appenders:{
        //definir las salidas de datos
        consola:{type:"console"},
        archivoErrores: {type:"file", filename:"./src/logs/error.log"},
        archivoWarn: {type:"file", filename:"./src/logs/warn.log"},
        //salidas con niveles definidos
        loggerConsola: {type:"logLevelFilter", appender:'consola', level:'info'},
        loggerErrores: {type:"logLevelFilter", appender:'archivoErrores', level:'error'},
        loggerWarn: {type:"logLevelFilter", appender:'archivoWarn', level:'warn'},
    },
    categories:{
        default:{appenders:['loggerConsola'], level:'all'},
        produccion:{appenders:['loggerErrores','loggerWarn'], level:'all'}
    }
});

let logger=null;

if(envConfig.NODE_ENV === "prod"){
    logger = log4js.getLogger("produccion");
} else {
    logger = log4js.getLogger()
};

export {logger};