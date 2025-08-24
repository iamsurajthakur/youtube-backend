import dotenv from "dotenv"
import connectDB from "./db/database.js";

dotenv.config({
    path: './env'
})

connectDB()
.then(()=>{
    
    app.on("error", (err)=> {
        console.log("Error: ",err);
        throw err
    })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port ${process.env.PORT}`);
        
    })
})
.catch((err)=>{
    console.log("mongoDB connection failed !!",err);
})
