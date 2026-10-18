from rest_framework import serializers

class SorobanContractInfoSerializer(serializers.Serializer):
    contract_name = serializers.CharField()
    network = serializers.CharField()
    contract_id = serializers.CharField()
    usdc_token_id = serializers.CharField()
    methods = serializers.ListField(child=serializers.DictField())
    evm_contract_available = serializers.BooleanField()
    evm_contract_name = serializers.CharField()

class SorobanPayInvocationRequestSerializer(serializers.Serializer):
    payer_address = serializers.CharField(max_length=56, help_text="Customer Stellar public key")
    reference_id = serializers.CharField(max_length=32, help_text="SMEHUB invoice reference ID")

class SorobanPayInvocationResponseSerializer(serializers.Serializer):
    contract_id = serializers.CharField()
    method = serializers.CharField()
    args = serializers.DictField()
    network_passphrase = serializers.CharField()
    memo = serializers.CharField()
