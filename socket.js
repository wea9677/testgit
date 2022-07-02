const socketIo = require("socket.io");
const http = require("./app");


const io = socketIo(http);
//소켓이네



function initSocket(sock) { //initsocket 안에서만 일어나는 이벤트
    console.log('새로운 소켓이 연결됐어요!');

    // 특정 이벤트가 전달됐는지 감지할 때 사용될 함수
    // function watchEvent(event, func) {
    //   sock.on(event, func);
    // } sock.on으로 대체가능

    // 연결된 모든 클라이언트에 데이터를 보낼때 사용될 함수
    function notifyEveryone(event, data) {
        io.emit(event, data);
    }

    return {
        watchBuying: () => { //buy 이벤트를 감시하다가 감지하면 제공된 정보를 모두에게 뿌린다.(구매내역 체크 => 페이지 접속자들에게 알람으로 정보 전달)
            sock.on('BUY', (data) => {
                const emitData = {
                    ...data,
                    date: new Date().toISOString(),
                };
                notifyEveryone('BUY_GOODS', emitData);
            });
        },

        watchByebye: () => { //페이지를 떠나는 것을 감시하다 감지하면 알려준다.
            sock.on('disconnect', () => {
                console.log(sock.id, '연결이 끊어졌어요!');
            });
        },
    };
}

io.on("connection", (socket) => {
    const { watchBuying, watchByebye } = initSocket(socket); //이 함수의 반환값은 ovject인데 반환값은 watchBuying, watchByebye 


    watchBuying();

    watchByebye();

});