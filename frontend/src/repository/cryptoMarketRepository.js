import customAxios from "../customAxios/axios.js"

const cryptoMarketRepository = {
    getCoins: async () => {
        return await customAxios.get("/coins");
    },
    getCoin: async(symbol) => {
        return await customAxios.get(`/coins/${symbol}`)
    },
    analyzeCrypto: async(symbol) => {
        return await customAxios.get(`/${symbol}/analyze`)
    },
    fetchNews: async(filter) => {
        return await customAxios.get(`/news?filter=${filter}`)
    },
    fetchCoinNews: async (symbol) => {
        return await customAxios.get(`/news?currencies=${symbol}`);
    }
}

export default cryptoMarketRepository;