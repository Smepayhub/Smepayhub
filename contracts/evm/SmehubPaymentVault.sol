// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for standard ERC20 token transfers
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SmehubPaymentVault
 * @notice Multi-currency merchant payment settlement vault for SMEHUB
 */
contract SmehubPaymentVault {
    enum InvoiceStatus { Pending, Paid, Cancelled, Expired }

    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address payer;
        address token;
        uint256 amount;
        uint256 feeAmount;
        uint256 netAmount;
        InvoiceStatus status;
        uint256 createdAt;
        uint256 paidAt;
        uint256 expiry;
    }

    struct MerchantProfile {
        address merchant;
        string businessName;
        uint256 totalVolume;
        uint256 invoiceCount;
        bool isActive;
    }

    address public owner;
    address public feeCollector;
    uint256 public feeBasisPoints; // e.g., 50 = 0.5%
    uint256 public totalPlatformVolume;

    mapping(address => MerchantProfile) public merchants;
    mapping(bytes32 => Invoice) public invoices;

    event MerchantRegistered(address indexed merchant, string businessName);
    event InvoiceCreated(bytes32 indexed invoiceId, address indexed merchant, address token, uint256 amount, uint256 expiry);
    event PaymentSettled(bytes32 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount, uint256 fee);
    event InvoiceCancelled(bytes32 indexed invoiceId, address indexed merchant);
    event FeeConfigUpdated(address indexed feeCollector, uint256 feeBasisPoints);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMerchant(bytes32 invoiceId) {
        require(invoices[invoiceId].merchant == msg.sender, "Not invoice merchant");
        _;
    }

    constructor(address _feeCollector, uint256 _feeBasisPoints) {
        require(_feeBasisPoints <= 1000, "Fee bps exceeds max 10%");
        owner = msg.sender;
        feeCollector = _feeCollector;
        feeBasisPoints = _feeBasisPoints;
    }

    function registerMerchant(string calldata businessName) external {
        require(bytes(businessName).length > 0, "Empty name");
        require(!merchants[msg.sender].isActive, "Already registered");

        merchants[msg.sender] = MerchantProfile({
            merchant: msg.sender,
            businessName: businessName,
            totalVolume: 0,
            invoiceCount: 0,
            isActive: true
        });

        emit MerchantRegistered(msg.sender, businessName);
    }

    function createInvoice(
        bytes32 invoiceId,
        address token,
        uint256 amount,
        uint256 expiry
    ) external {
        require(merchants[msg.sender].isActive, "Merchant not registered");
        require(invoices[invoiceId].merchant == address(0), "Invoice already exists");
        require(amount > 0, "Invalid amount");
        require(token != address(0), "Invalid token address");

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            payer: address(0),
            token: token,
            amount: amount,
            feeAmount: 0,
            netAmount: amount,
            status: InvoiceStatus.Pending,
            createdAt: block.timestamp,
            paidAt: 0,
            expiry: expiry
        });

        merchants[msg.sender].invoiceCount += 1;

        emit InvoiceCreated(invoiceId, msg.sender, token, amount, expiry);
    }

    function payInvoice(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.merchant != address(0), "Invoice does not exist");
        require(invoice.status == InvoiceStatus.Pending, "Invoice not pending");
        if (invoice.expiry > 0) {
            require(block.timestamp <= invoice.expiry, "Invoice expired");
        }

        uint256 fee = (invoice.amount * feeBasisPoints) / 10000;
        uint256 net = invoice.amount - fee;

        invoice.status = InvoiceStatus.Paid;
        invoice.payer = msg.sender;
        invoice.paidAt = block.timestamp;
        invoice.feeAmount = fee;
        invoice.netAmount = net;

        merchants[invoice.merchant].totalVolume += net;
        totalPlatformVolume += invoice.amount;

        // Perform token transfers
        if (fee > 0 && feeCollector != address(0)) {
            require(IERC20(invoice.token).transferFrom(msg.sender, feeCollector, fee), "Fee transfer failed");
        }
        require(IERC20(invoice.token).transferFrom(msg.sender, invoice.merchant, net), "Merchant transfer failed");

        emit PaymentSettled(invoiceId, invoice.merchant, msg.sender, invoice.amount, fee);
    }

    function cancelInvoice(bytes32 invoiceId) external onlyMerchant(invoiceId) {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == InvoiceStatus.Pending, "Cannot cancel non-pending invoice");

        invoice.status = InvoiceStatus.Cancelled;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) {
        return invoices[invoiceId];
    }

    function setFeeConfig(address _feeCollector, uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee bps exceeds max 10%");
        feeCollector = _feeCollector;
        feeBasisPoints = _feeBasisPoints;
        emit FeeConfigUpdated(_feeCollector, _feeBasisPoints);
    }
}
