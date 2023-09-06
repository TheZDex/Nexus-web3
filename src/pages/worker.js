const web3 = require("web3");
const params={
    data:{
        enabled:false,
        cursor: 0
    }
}
if (typeof window !== "undefined"){
    addEventListener('message', (event) => {
        const {data} = event;
        console.log('worker',data);
        Object.assign(params.data,data);
        postMessage({ack:params.data});
    });
    const batch_size=1e5;   
    setInterval(()=>{
        if(params.data.enabled){
            const {nounce,blockNumberV,supplyV,mintFor,cursor,bar}=params.data;
            for(let i=0;i<batch_size;i++){
                const encoded = web3.utils.encodePacked(
                    {t:'uint256',v:nounce},
                    {t:'uint256',v:blockNumberV},
                    {t:'uint256',v:supplyV},
                    {t:'address',v:mintFor},
                    {t:'uint256',v:cursor+i}
                );
                const hash = web3.utils.keccak256(encoded);
                if(web3.utils.toBigInt(hash)<=bar){
                    params.data.enabled=false;
                    postMessage({nounce:cursor+i});
                    break;
                }
            }
            params.data.cursor+=batch_size;
            postMessage({cursor:params.data.cursor});
        }
    },1000);
}

export default ()=>{};