import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs/promises'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

/////////////////////////
// Uploads an image file
/////////////////////////

const uploadImage = async (imagePath) => {

    if (!imagePath) return null

    const options = {
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        resource_type: 'auto'
    };

    try {
        if (!imagePath) return null

        // Upload the image
        const result = await cloudinary.uploader.upload(imagePath, options);
        console.log(result);
        return result;
    } catch (error) {
        console.error("Cloudnary upload failed: ", error.message)
        throw error
    } finally {
        try{
            await fs.unlink(imagePath) // remove the saved file it upload failed
        } catch (unLinkError){
            console.warn("Failed to delete temp file:", unlinkError.message);
        }
    }
};

export default uploadImage