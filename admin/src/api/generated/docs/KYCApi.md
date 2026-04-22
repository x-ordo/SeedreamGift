# KYCApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**kycBankAccountGet**](#kycbankaccountget) | **GET** /kyc/bank-account | 등록된 계좌 조회|
|[**kycBankAccountPost**](#kycbankaccountpost) | **POST** /kyc/bank-account | 계좌 변경|
|[**kycBankVerifyConfirmPost**](#kycbankverifyconfirmpost) | **POST** /kyc/bank-verify/confirm | 1원 인증 확인|
|[**kycBankVerifyRequestPost**](#kycbankverifyrequestpost) | **POST** /kyc/bank-verify/request | 1원 인증 요청|
|[**kycVerifySmsPost**](#kycverifysmspost) | **POST** /kyc/verify-sms | SMS 본인인증 처리|

# **kycBankAccountGet**
> InternalApiHandlersAPIResponse kycBankAccountGet()


### Example

```typescript
import {
    KYCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KYCApi(configuration);

const { status, data } = await apiInstance.kycBankAccountGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycBankAccountPost**
> InternalApiHandlersAPIResponse kycBankAccountPost(body)


### Example

```typescript
import {
    KYCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KYCApi(configuration);

let body: object; //인증 거래번호 및 인증어

const { status, data } = await apiInstance.kycBankAccountPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 인증 거래번호 및 인증어 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycBankVerifyConfirmPost**
> InternalApiHandlersAPIResponse kycBankVerifyConfirmPost(body)


### Example

```typescript
import {
    KYCApi,
    Configuration,
    WGiftServerInternalAppServicesBankVerifyConfirmRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new KYCApi(configuration);

let body: WGiftServerInternalAppServicesBankVerifyConfirmRequest; //인증 확인 정보

const { status, data } = await apiInstance.kycBankVerifyConfirmPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalAppServicesBankVerifyConfirmRequest**| 인증 확인 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycBankVerifyRequestPost**
> InternalApiHandlersAPIResponse kycBankVerifyRequestPost(body)


### Example

```typescript
import {
    KYCApi,
    Configuration,
    WGiftServerInternalAppServicesBankVerifyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new KYCApi(configuration);

let body: WGiftServerInternalAppServicesBankVerifyRequest; //은행 계좌 정보

const { status, data } = await apiInstance.kycBankVerifyRequestPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalAppServicesBankVerifyRequest**| 은행 계좌 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **kycVerifySmsPost**
> InternalApiHandlersAPIResponse kycVerifySmsPost(body)


### Example

```typescript
import {
    KYCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new KYCApi(configuration);

let body: object; //휴대폰 번호

const { status, data } = await apiInstance.kycVerifySmsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 휴대폰 번호 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

