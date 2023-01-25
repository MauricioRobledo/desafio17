import * as dotenv from "dotenv"

dotenv.config()

export const config = {
    mongoUrlSessions: process.env.mongoUrlSessions,
    mongoUrl: process.env.mongoUrl,
    clave: process.env.clave
}