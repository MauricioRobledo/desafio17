import express from 'express';
import {ContenedorMysql} from "../managers/contenedorSql.js";
import {options} from "../config/dbConfig.js";
import { logger } from '../logger.js';
const router = express.Router();

// const productosApi = new Contenedor("productos.txt");
const productosApi = new ContenedorMysql(options.mariaDB, "products");

router.get('/',async(req,res)=>{
    const productos = await productosApi.getAll();
    res.send(productos);
})

router.get('/:id',async(req,res)=>{
    const productId = req.params.id;
    const product = await productosApi.getById(parseInt(productId));
    if(product){
        return res.send(product)
    } else{
        logger.error("Producto no encontrado")
        return res.send({error : 'producto no encontrado'})
    }
})

router.post('/',async(req,res)=>{
    const newProduct = req.body;
    const result = await productosApi.save(newProduct);
    if(!result){
        logger.error("Error al crear el producto")
        res.send("No se pudo crear el producto")
    }else{
        res.send(result);
    }
})

router.put('/:id',async(req,res)=>{
    const cambioObj = req.body;
    const productId = req.params.id;
    const result = await productosApi.updateById(parseInt(productId),cambioObj);
    if(!result){
        logger.error("Error al actualizar el producto")
        res.send("No se pudo actualizar el producto")
    }else{
        res.send(result);
    }
})

router.delete('/:id',async(req,res)=>{
    const productId = req.params.id;
    const result = await productosApi.deleteById(parseInt(productId));
    if(!result){
        logger.error("Error al eliminar producto")
        res.send("No se pudo eliminar el producto")
    }else{
        res.send(result);
    }
    
})


export {router};