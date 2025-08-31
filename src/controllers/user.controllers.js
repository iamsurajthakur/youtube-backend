import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js"
import { User } from "../models/user.models.js"
import uploadOnCloudinary from "../utils/fileUpload.js"
import ApiResponse from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user detail from frontend
    const { username, email, fullname, password } = req.body
    // validation
    // begginer level code
    // if(fullname === ""){
    //     throw new apiError(400,"fullname is required")
    // }

    // advanced code
    if (
        [fullname, email, username, password].some((feild) => feild?.trim() === "")
    ) {
        throw new apiError(400, "All feild are required")
    }
    // check if user already exists or not 
    const existingUser = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    })

    if (existingUser) {
        throw new apiError(409, "User with email or username already exists")
    }
    // check if avatar and check if cover image (optional)
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new apiError(400, "avatar file is required")
    }
    // upload them to cloudnary, check avatar is uploaded or not
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "avatar file is required")
    }
    // create user object - creat entry in db
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })
    // remove password and refreshtoken feild from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    // check for user creation
    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }
    // return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully !!!")
    )

})

export default registerUser