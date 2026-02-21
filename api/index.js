module.exports = (req, res) => {
    res.status(200).json({ test: 'ok', token: !!process.env.MINERU_TOKEN });
};
