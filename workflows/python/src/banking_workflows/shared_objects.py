from dataclasses import dataclass


@dataclass
class DepositResponse:
    def __init__(self, chargeId: str) -> None:
        self.chargeId = chargeId

    chargeId: str

    def get_chargeId(self):
        return self.chargeId


@dataclass
class TransferInput:
    amount: float
    fromAccount: str
    toAccount: str


@dataclass
class TransferOutput:
    def __init__(self, depositResponse: str) -> None:
        self.depositResponse = depositResponse

    depositResponse: str


@dataclass
class TransferStatus:
    def __init__(
        self,
        progress: int,
        transferState: str,
        workflowStatus: str,
        depositResponse: DepositResponse,
        approvalTime: int,
    ) -> None:
        self.progressPercentage = progress
        self.transferState = transferState
        self.workflowStatus = workflowStatus
        self.chargeResult = depositResponse
        self.approvalTime = approvalTime

    progressPercentage: int
    transferState: str
    workflowStatus: str
    chargeResult: DepositResponse
    approvalTime: int
