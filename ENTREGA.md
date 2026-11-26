# Registro de entrega da equipe

## Integrantes

- Nome completo: Gabriel Henrique Costa Oliveira
- Nome completo: Fernando Marinho de Freitas Filho

## Correções de modelagem

Descreva os problemas encontrados, as alterações feitas e a nova migration.

Antes, a tabela Booking deixava o horário de término em aberto e permitia duas reservas da mesma sala começando no mesmo horário. Agora o término é obrigatório, e uma sala não pode mais ter duas reservas com o mesmo início.

## Endpoints e evidências

Para cada endpoint, informe se está concluído, parcialmente concluído ou não implementado. Registre a requisição (método, URL, body quando aplicável), status e resposta de pelo menos um cenário de sucesso e um de erro para cada endpoint implementado.

| Endpoint | Situação | Evidência de sucesso | Evidência de erro |
|---|---|---|---|
| 1 | Concluído | `GET /api/rooms?buildingId=1&active=true` → 200, lista as salas ativas do prédio 1 (1, 2 e 3) | `GET /api/rooms?minCapacity=abc` → 400 `VALIDATION_ERROR`, parâmetro de capacidade inválido |
| 2 | Concluído | `GET /api/buildings/1/usage?date=2026-11-27` → 200, taxa de ocupação do prédio de 14,29% | `GET /api/buildings/999/usage?date=2026-11-27` → 404 `BUILDING_NOT_FOUND`, prédio inexistente |
| 3 | Concluído | `POST /api/bookings` na sala 3, das 11h às 12h → 201, reserva criada | `POST /api/bookings` na sala 4 → 409 `ROOM_INACTIVE`, sala inativa não aceita reserva |
| 4 | Concluído | `PATCH /api/bookings/1` alterando `purpose` → 200, reserva atualizada | `PATCH /api/bookings/1` com `roomId: 4` → 409 `ROOM_INACTIVE`, não move para sala inativa |
| 5 | Concluído | `DELETE /api/bookings/1` → 204, sem corpo na resposta | `DELETE /api/bookings/9999` → 404 `BOOKING_NOT_FOUND`, reserva inexistente |

## Observações

Descreva dificuldades, limitações e, quando aplicável, conquistas da gamificação.

Nenhuma observação