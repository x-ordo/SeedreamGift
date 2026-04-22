# AdminRefundsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminRefundsGet**](#adminrefundsget) | **GET** /admin/refunds | 환불 목록 조회|
|[**adminRefundsIdApprovePost**](#adminrefundsidapprovepost) | **POST** /admin/refunds/{id}/approve | 환불 승인|
|[**adminRefundsIdGet**](#adminrefundsidget) | **GET** /admin/refunds/{id} | 환불 상세 조회|
|[**adminRefundsIdRejectPost**](#adminrefundsidrejectpost) | **POST** /admin/refunds/{id}/reject | 환불 거부|

# **adminRefundsGet**
> InternalApiHandlersAPIResponse adminRefundsGet()


### Example

```typescript
import {
    AdminRefundsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminRefundsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminRefundsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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

# **adminRefundsIdApprovePost**
> InternalApiHandlersAPIResponse adminRefundsIdApprovePost()


### Example

```typescript
import {
    AdminRefundsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminRefundsApi(configuration);

let id: number; //환불 ID (default to undefined)

const { status, data } = await apiInstance.adminRefundsIdApprovePost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 환불 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminRefundsIdGet**
> InternalApiHandlersAPIResponse adminRefundsIdGet()


### Example

```typescript
import {
    AdminRefundsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminRefundsApi(configuration);

let id: number; //환불 ID (default to undefined)

const { status, data } = await apiInstance.adminRefundsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 환불 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminRefundsIdRejectPost**
> InternalApiHandlersAPIResponse adminRefundsIdRejectPost()


### Example

```typescript
import {
    AdminRefundsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminRefundsApi(configuration);

let id: number; //환불 ID (default to undefined)

const { status, data } = await apiInstance.adminRefundsIdRejectPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 환불 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

