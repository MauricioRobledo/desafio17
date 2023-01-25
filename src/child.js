const numeroRandom = (cant) =>{
    const numeros =[]
    for(let i=0;i<cant;i++){
        const num = Math.round(Math.random() * 1000)
        numeros.push(num)
        
    }
    return numeros
}

process.send("listo")

process.on("message",(parentMsg)=>{
    const resultado = numeroRandom(parentMsg)
    process.send(resultado)
})