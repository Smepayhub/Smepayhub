import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

class StellarVerificationError(Exception):
    """Raised when a Stellar blockchain transaction verification fails."""
    pass

class PaymentRequestExpiredError(Exception):
    """Raised when an action is attempted on an expired payment request."""
    pass

def custom_exception_handler(exc, context):
    """
    Standardized API exception handler producing a uniform JSON envelope:
    {
        "success": False,
        "message": "Human readable description",
        "errors": [...]
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            'success': False,
            'message': 'An error occurred while processing the request.',
            'errors': response.data,
            'status_code': response.status_code,
        }

        # Normalize message if string error
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                custom_data['message'] = str(response.data['detail'])
            elif 'error' in response.data:
                custom_data['message'] = str(response.data['error'])
        elif isinstance(response.data, list) and response.data:
            custom_data['message'] = str(response.data[0])

        response.data = custom_data
        return response

    if isinstance(exc, StellarVerificationError):
        return Response({
            'success': False,
            'message': str(exc),
            'errors': {'stellar_error': [str(exc)]},
            'status_code': status.HTTP_400_BAD_REQUEST,
        }, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, PaymentRequestExpiredError):
        return Response({
            'success': False,
            'message': str(exc),
            'errors': {'payment_status': ['Payment request has expired']},
            'status_code': status.HTTP_410_GONE,
        }, status=status.HTTP_410_GONE)

    logger.exception("Unhandled server error: %s", exc)
    return Response({
        'success': False,
        'message': 'An internal server error occurred.',
        'errors': {'internal': [str(exc)]},
        'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR,
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
