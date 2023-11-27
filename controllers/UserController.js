import User from '../models/User.js'
import generateToken from '../config/generateToken.js';

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

const validatePhone = (phone) => {
    return phone.match(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
}

// [GET] /api/users
export const getAllUsers = (req, res, next) =>{
    User.find({})
        .then(users => res.status(201).json(users))
        .catch(next)
}

//[POST] /api/users
export const registerUser = async (req,res, next) => {
    const {name, email, password, avatar, phoneNumber} = req.body
    if(!name || !email || !password || !phoneNumber) {
        res.status(400)
        return next(new Error('Bạn phải điền các thông tin cần thiết'))
    }

    if(!validateEmail(email)){
        res.status(400)
        return next(new Error('Email không hợp lệ'))
    }

    if(!validatePhone(phoneNumber)){
        res.status(400)
        return next(new Error('Số điện thoại không hợp lệ'))
    }

    const userExist = await User.findOne({email})

    if(userExist) {
        res.status(400)
        return next(new Error('Email đã được sử dụng'))
    }

    const user = new User(req.body)
    user.save()
        .then(user => {
            delete user.password
            res.status(201).json({
                _id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                phoneNumber: user.phoneNumber,
                address: user.address,
                province: user.province,
                district: user.district,
                ward: user.ward,
                token: generateToken(user._id)
            })
        })
        .catch(next)
}

//[POST] /api/users/login
export const authUser = async (req, res, next) => {
    const {email, password} = req.body
    if(!email || !password) {
        res.status(400)
        return next(new Error('Bạn phải điền các thông tin cần thiết'))
    }

    const user = await User.findOne({ email })
    if(user && (await user.matchPassword(password))) {
        res.status(201).json({
            _id: user._id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            phoneNumber: user.phoneNumber,
            address: user.address,
            province: user.province,
            district: user.district,
            token: generateToken(user._id)
        })
    }
    else{
        res.status(401)
        next(new Error('Invalid email or password !')) 
    }
}