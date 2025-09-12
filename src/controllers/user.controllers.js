import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js"
import { User } from "../models/user.models.js"
import uploadOnCloudinary from "../utils/fileUpload.js"
import ApiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";
import { response } from "express";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
       const user = await User.findById(userId) 
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()

       user.refreshToken = refreshToken
       await user.save({validateBeforeSave: false})

       return {accessToken, refreshToken}

    } catch (error) {
        throw new apiError(500,'something went wrong.')
    }
}

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

const loginUser = asyncHandler(async (req,res) => {
    // get req.body data and extract username and email
    // check if username and email is provided or not
    // check if username and email exists in the database
    // generate refresh token and access token
    // send cokiee

    const {username, email, password} = req.body

    if(!(username || email)){
        throw new apiError(400,'Please provide username or email.')
    }

    const user = await User.findOne({
        $or: [
            {email},
            {username}
        ]
    })

    if(!user){
        throw new apiError(400,'user not found.')
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if(!isPasswordValid){
        throw new apiError(401,'Password incorrect.')
    }  
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
            {
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged In successfully"
    )
    )

})

const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

        const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logout.'))
})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new apiError(401,'unauthorized request')
    }

    try {
            const decodedRefreshToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
            if(!decodedRefreshToken){
                throw new apiError(401,'Invalid request')
            }
            
            const user = await User.findById(decodedRefreshToken?._id)
    
            if(!user){
                throw new apiError(401,'invalid refresh token')
            }
    
            if(incomingRefreshToken !== user?.refreshToken){
                throw new apiError(401,'Refresh token is expired or used')
            }
    
            const options = {
                httpOnly: true,
                secure: true
            }
    
            const {newAccessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
            return res
            .status(200)
            .cookie('accessToken', newAccessToken, options)
            .cookie('refreshToken', newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {newAccessToken, newRefreshToken},
                    'access token refreshed'
                )
            )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    if(!user){
        throw new apiError(401, "User not found.")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new apiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return response
    .status(200)
    .json(
        new ApiResponse(200, {} ,"Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully.")
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new apiError(400,"All feild required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated."))
})

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar")
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    )
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover image.")
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: coverImage.url
            }
        },
        {new: true}
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage
}