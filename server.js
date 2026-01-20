require('dotenv').config(); // Esta linha lê o arquivo .env
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// O código agora busca a chave automaticamente do arquivo .env
const PAYEVO_API_URL = 'https://apiv2.payevo.com.br/functions/v1/transactions';
const PAYEVO_SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

app.use(cors( ));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/payments/:method', async (req, res) => {
    const { method } = req.params;
    const paymentData = req.body;
    try {
        const authHeader = `Basic ${Buffer.from(PAYEVO_SECRET_KEY + ':').toString('base64')}`;
        const response = await axios.post(PAYEVO_API_URL, paymentData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response ? error.response.status : 500).json(error.response ? error.response.data : { message: 'Erro' });
    }
});

app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
