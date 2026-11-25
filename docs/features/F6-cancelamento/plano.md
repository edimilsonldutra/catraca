# F6 — Cancelamento: plano

1. Serviço `cancelEvent` com a trava do evento e a atualização dos ingressos na mesma transação.
2. Rota de cancelamento e seção "Cancelar evento" na gestão (só em publicado).
3. Bloquear edição e publicação de evento cancelado (rota e página).
4. Testes: estorno e cancelamento dos ingressos, resposta tardia do gateway, vitrine e API sem o evento,
   compra pela API `404`, check-in "Evento cancelado", painel depois do cancelamento, edição e
   republicação recusadas, cancelamento por outro organizador.
