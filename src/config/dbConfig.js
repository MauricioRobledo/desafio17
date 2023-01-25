import path from "path";
import { fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename);

const options = {
    mariaDB:{
        client:"mysql",
        connection:{
            host:"127.0.0.1",
            user:"root",
            password:"",
            database:"coderhousedb"
        }
    },
    sqliteDB:{
        client:"sqlite3",
        connection:{
            filename: path.join(__dirname, "../DB/chatDB.sqlite")
        }
    }
}

export {options}