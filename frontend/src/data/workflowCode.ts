export interface CodeLine {
  text: string;
  indent: number;
  step?: string;
  isComment?: boolean;
  isDecorator?: boolean;
  isBlank?: boolean;
}

export const pythonCode: CodeLine[] = [
  { text: "@workflow.defn", indent: 0, isDecorator: true },
  { text: "class AccountTransferWorkflow:", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "  @workflow.run", indent: 1, isDecorator: true },
  { text: "  async def run(self, transfer):", indent: 1 },
  { text: "    compensations = []", indent: 2 },
  { text: "    try:", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "      # Validate the transfer", indent: 3, isComment: true },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "validate",
  },
  { text: "        validate, transfer,", indent: 4, step: "validate" },
  { text: "        retry=RetryPolicy(max=3))", indent: 4, step: "validate" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Withdraw — register compensation first",
    indent: 3,
    isComment: true,
  },
  {
    text: "      compensations.append(undo_withdraw)",
    indent: 3,
    step: "withdraw",
  },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "withdraw",
  },
  { text: "        withdraw, transfer,", indent: 4, step: "withdraw" },
  { text: "        retry=RetryPolicy(max=10,", indent: 4, step: "withdraw" },
  { text: "          backoff=1.5))", indent: 4, step: "withdraw" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Wait for approval (human in the loop)",
    indent: 3,
    isComment: true,
  },
  {
    text: "      await workflow.wait_condition(",
    indent: 3,
    step: "approval_wait",
  },
  { text: "        lambda: self.approved,", indent: 4, step: "approval_wait" },
  {
    text: "        timeout=timedelta(seconds=30))",
    indent: 4,
    step: "approval_wait",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Deposit — retries automatically",
    indent: 3,
    isComment: true,
  },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "deposit",
  },
  { text: "        deposit, transfer,", indent: 4, step: "deposit" },
  { text: "        retry=RetryPolicy(max=10,", indent: 4, step: "deposit" },
  { text: "          backoff=1.5))", indent: 4, step: "deposit" },
  { text: "", indent: 0, isBlank: true },
  { text: "      # Notify customer of success", indent: 3, isComment: true },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "send_notification_success",
  },
  {
    text: "        send_notification, transfer)",
    indent: 4,
    step: "send_notification_success",
  },
];

export const pythonCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "    # Saga: run compensations in reverse",
    indent: 2,
    isComment: true,
  },
  { text: "    except Exception:", indent: 2 },
  {
    text: "      for comp in reversed(compensations):",
    indent: 3,
    step: "undo_withdraw",
  },
  { text: "        await comp(transfer)", indent: 4, step: "undo_withdraw" },
  {
    text: "      await send_notification(fail=True)",
    indent: 3,
    step: "send_notification_failure",
  },
];
