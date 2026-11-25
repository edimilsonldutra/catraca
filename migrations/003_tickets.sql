CREATE TABLE tickets (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  event_id text NOT NULL REFERENCES events (id),
  user_id text REFERENCES users (id),
  buyer_email text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('web', 'partner')),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded')),
  card_last4 text NOT NULL,
  gateway_result text NOT NULL CHECK (gateway_result IN ('confirmed', 'declined')),
  gateway_due_at timestamptz NOT NULL,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_event_status_idx ON tickets (event_id, status);
CREATE INDEX tickets_user_idx ON tickets (user_id, created_at);
-- O processo do gateway só procura pendentes vencidos.
CREATE INDEX tickets_pending_due_idx ON tickets (gateway_due_at) WHERE status = 'pending';
