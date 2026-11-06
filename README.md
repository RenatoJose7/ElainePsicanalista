# Elainne Andrade — Site profissional e agendamento

**Website institucional com jornada de agendamento e integração de pagamento, desenvolvido para uma profissional de psicanálise.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/)

**[Ver site](https://elaine-psicanalista.vercel.app/)** · **[Conhecer a Mireva](https://mirevadesign.com.br/)**

## Sobre o projeto

O objetivo foi reunir apresentação profissional, informações sobre os atendimentos e uma experiência simples para quem deseja conhecer os serviços ou solicitar um agendamento. Além da interface, o repositório inclui lógica de agenda e integrações de backend.

## Funcionalidades e recursos

- Páginas institucionais e conteúdos sobre diferentes temas de atendimento.
- Fluxos de agendamento e remarcação.
- Consulta de horários ocupados por endpoint de disponibilidade.
- Estrutura de checkout e integração com Mercado Pago por funções de API.
- Páginas de política de privacidade e arquivos de descoberta/indexação, incluindo `robots.txt` e `sitemap.xml`.
- Layout adaptado para diferentes tamanhos de tela.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML, CSS e JavaScript |
| Backend | Cloudflare Pages Functions |
| Persistência | Consultas SQL por binding de banco D1 nas funções |
| Pagamentos | Integração Mercado Pago presente em `functions/api` |
| Configuração | `wrangler.jsonc` e `.env.example` |

## Estrutura do repositório

```text
├── index.html
├── style.css / script.js
├── agendamento.html / agendamento.js
├── agendamento-e-remarcacao/
├── functions/api/
├── database/
├── img/
└── wrangler.jsonc
```

## Execução local

A interface pode ser aberta com um servidor estático local. Os recursos de agenda, banco e pagamento dependem das configurações e bindings do ambiente de implantação. Consulte `.env.example` e `CLOUDFLARE_PAGES_SETUP.md`; não publique credenciais.

## Contexto

Projeto comercial desenvolvido no contexto da **Mireva Design & Sistemas**, com foco em experiência do usuário, presença digital e integração entre interface e processos de agendamento.

---

**Desenvolvimento:** [Renato José](https://github.com/RenatoJose7) · [Mireva](https://mirevadesign.com.br/)
