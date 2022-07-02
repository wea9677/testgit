const jwt = require("jsonwebtoken");
const { User } = require("../models")

module.exports = (req, res, next) => {
//    console.log("여기를 지나쳤어요!")
   const { authorization } = req.headers;
    // console.log(authorization)
    const [tokenType, tokenValue] = authorization.split(' ');
    // console.log(tokenValue);

    if (tokenType !== 'Bearer') {
        res.status(401).send({
            errorMessage: '로그인이 필요한 페이지 입니다.',
        });
        return;
    }
    try {
        const { userId } = jwt.verify(tokenValue, "Urgot");

        User.findByPk(userId).then((user) => {
            res.locals.user = user;
            next();
          });

    } catch (error) {
        res.status(401).send({
        errorMessage: '로그인 후 사용하세요',
        });
        return;
    }

  
    
};