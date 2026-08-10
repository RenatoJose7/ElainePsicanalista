# Configuração para Cloudflare Pages

## 1. Banco de pedidos

No Cloudflare Dashboard, crie um banco **D1** e execute o conteúdo de `database/schema.sql`.
No projeto Pages, adicione o binding D1 com o nome `ORDERS`.

## 2. Secrets de produção e preview

Em **Workers & Pages > seu projeto > Settings > Variables and Secrets**, crie como secrets:

```
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM
EMAIL_OWNER_TO
```

Crie como variável comum:

```
MERCADO_PAGO_ENVIRONMENT=test
```

## 3. Webhook Mercado Pago

No painel da aplicação Mercado Pago, em **Webhooks**, configure o evento **Pagamentos** para:

```
https://SEU-DOMINIO/api/mercado-pago/webhook
```

Copie a assinatura secreta gerada para o secret `MERCADO_PAGO_WEBHOOK_SECRET`.

## 4. Resend

O domínio de `EMAIL_FROM` deve estar verificado no Resend. O e-mail só é enviado depois que o webhook consulta o Mercado Pago e confirma o status `approved`.
