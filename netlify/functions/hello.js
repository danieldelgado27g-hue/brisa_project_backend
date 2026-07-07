exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "DermaMatch API funcionando",
      version: "1.0.0"
    })
  };
};
