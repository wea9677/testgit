const express = require("express");
const { Op } = require("sequelize");
const Http = require("http");
const jwt = require("jsonwebtoken");
const { User, Cart, Goods } = require("./models");
const authMiddleware = require("./middlewares/auth-middleware");




const app = express();
const http = Http.createServer(app);
const router = express.Router();

const socketIdMap = {};     //빈 객체를 만들어서, key는 소켓아이디, value 에는 접속한 URL
                            //이러면 소켓 아이디, URL을 매핑 할 수 있다. 
                            //특정 URL에 몇명이 접속해 있는지도 알 수 있다.
                            //소켓 아이디를 처음 연결할때,

function emitsamePageViewrsCount(){
  const countByUrl = Object.values(socketIdMap).reduce((value, url)=>{   //reduce 함수를 사용.
       return {
         ...value,                      //만들어진 배열에서 초기값을 포함 두개씩 묶어서 반복하여
                                          //마지막 배열까지 반복한 작업이 최종 conuntByUrl 로 들어간다.
         [url]: value[url] ? value[url] + 1 : 1,      //한번 들어간 url이 있으면 +1 아니면 단순 1로 나오게 삼항자 연산
       };
  }, {});

  for ( const [socketId, url] of Object.entries(socketIdMap)) {      //entries 함수는 property 의 갯수만큼 배열을 반환 // 배열의 값에서 인덱스 0은 property의 key 이름, 인덱스 1이 property value 값
       const count = countByUrl[url];          //우리는 키가 url 값이므로 count 값에 키값 url을 넣는다.
       io.to(socketId).emit("SAME_PAGE_VIEWER_COUNT", count);

  }
}





// io.on("connection", (socket) => {
  // socketIdMap[socket.id] = null;  //연결을 했지만 어디있는지 모른다는 의미로 socketIdMap[socket.id] = null; 먼저 넣는다.
//   console.log("누군가 연결했어요!");
  // socket.on("CHANGED_PAGE", (data) =>{
  //   console.log("페이지가 바뀌었대요", data, socket.id);
  //   socketIdMap[socket.id] = data;

  //   emitsamePageViewrsCount();
  // });

  // // socket.emit("BUY_GOODS", {
  // //   nickname: '서버가 보내준 구매자 닉네임',
  // //   goodsId: 2, // 서버가 보내준 상품 데이터 고유 ID
  // //   goodsName: '서버가 보내준 구매자가 구매한 상품 이름',
  // //   date: '서버가 보내준 구매 일시'
  // // });

  // socket.on("BUY", (data) => {
  //   const payload = {
  //     nickname:data.nickname,
  //     goodsId:data.goodsId,
  //     goodsName:data.goodsName,
  //     date:new Date().toISOString(),
  //   };
  //   console.log("클라이언트가 구매한 데이터", data, new Date());
  //   // io.emit("BUY_GOODS", payload);
  //   socket.broadcast.emit("BUY_GOODS", payload); //나를 제외한 모두에게 데이터가 전달된다
  // });

  // socket.on("disconnect", ()=>{
  //   delete socketIdMap[socket.id];
  //   console.log("누군가 연결을 끊었어요!")
  // });
//});


//
// router.post("/goods", async (req, res) =>{
//   const { goodsId, name, thumbanilUrl, category, price } = req.body;

//   await Goods.create({ goodsId, name, thumbanilUrl, category, price });
//   console.log(goodsId, name, thumbanilUrl, category, price)
//   res.status(200).send({});

// });


//회원가입
router.post("/users", async (req, res) => {
  const { nickname, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    res.status(400).send({
      errorMessage: "패스워드가 패스워드 확인란과 동일하지 않습니다.",
    });
    return;
  }

  const existUsers = await User.findAll({
    where: {
      [Op.or]: [{ nickname }, { email }],
    },
  });
  if (existUsers.length) {
    res.status(400).send({
      errorMessage: "이미 가입된 이메일 또는 닉네임이 있습니다.",
    });
    return;
  }

  await User.create({ email, nickname, password });

  res.status(201).send({});
});

router.post("/auth", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email, password } });

  if (!user) {
    res.status(400).send({
      errorMessage: "이메일 또는 패스워드가 잘못됐습니다.",
    });
    return;
  }

  const token = jwt.sign({ userId: user.userId }, "Urgot");
  res.send({
    token,
  });
});

router.get("/users/me", authMiddleware, async (req, res) => {
  const { user } = res.locals;
  res.send({
    user,
  });
});

/**
 * 내가 가진 장바구니 목록을 전부 불러온다.
 */
router.get("/goods/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;

  const cart = await Cart.findAll({
    where: {
      userId,
    },
  });

  const goodsIds = cart.map((c) => c.goodsId);

  // 루프 줄이기 위해 Mapping 가능한 객체로 만든것
  const goodsKeyById = await Goods.findAll({
    where: {
      goodsId: goodsIds,
    },
  }).then((goods) =>
    goods.reduce(
      (prev, g) => ({
        ...prev,
        [g.goodsId]: g,
      }),
      {}
    )
  );

  res.send({
    cart: cart.map((c) => ({
      quantity: c.quantity,
      goods: goodsKeyById[c.goodsId],
    })),
  });
});

/**
 * 장바구니에 상품 담기.
 * 장바구니에 상품이 이미 담겨있으면 갯수만 수정한다.
 */
router.put("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;
  const { quantity } = req.body;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  });

  if (existsCart) {
    existsCart.quantity = quantity;
    await existsCart.save();
  } else {
    await Cart.create({
      userId,
      goodsId,
      quantity,
    });
  }

  // NOTE: 성공했을때 응답 값을 클라이언트가 사용하지 않는다.
  res.send({});
});

/**
 * 장바구니 항목 삭제
 */
router.delete("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  });

  // 있든 말든 신경 안쓴다. 그냥 있으면 지운다.
  if (existsCart) {
    await existsCart.destroy();
  }

  // NOTE: 성공했을때 딱히 정해진 응답 값이 없다.
  res.send({});
});

/**
 * 모든 상품 가져오기
 * 상품도 몇개 없는 우리에겐 페이지네이션은 사치다.
 * example
 * /api/goods
 * /api/goods?category=drink
 * /api/goods?category=drink2
 */
router.get("/goods", authMiddleware, async (req, res) => {
  const { category } = req.query;
  const goods = await Goods.findAll({
    order: [["goodsId", "DESC"]],
    where: category ? { category } : undefined,
  });

  res.send({ goods });
});

/**
 * 상품 하나만 가져오기
 */
router.get("/goods/:goodsId", authMiddleware, async (req, res) => {
  const { goodsId } = req.params;
  const goods = await Goods.findByPk(goodsId);

  if (!goods) {
    res.status(404).send({});
  } else {
    res.send({ goods });
  }
});

app.use("/api", express.urlencoded({ extended: false }), router);
app.use(express.static("assets"));



module.exports = http;

