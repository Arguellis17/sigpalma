-- Notificación en tiempo real al operario cuando le asignan un monitoreo fitosanitario.
-- El servidor emite un evento Broadcast en el canal privado `monitoreos:<user_id>` al crear o
-- reasignar la programación. Esta política (Realtime Authorization) permite que solo el propio
-- operario reciba los mensajes de su canal.
DROP POLICY IF EXISTS operario_recibe_monitoreos_asignados ON realtime.messages;
CREATE POLICY operario_recibe_monitoreos_asignados ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'monitoreos:' || auth.uid()::text
  );
