import customAxios from "../customAxios/axios.js"

const cryptoOhlcvRepository = {
    getCoin: async (symbol, range) => {
        return await customAxios.get(`/${symbol}?range=${range}`)
    }
}

export default cryptoOhlcvRepository