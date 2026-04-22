# AdminAuditLogsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminAuditLogsGet**](#adminauditlogsget) | **GET** /admin/audit-logs | 감사 로그 목록 조회|
|[**adminAuditLogsIdGet**](#adminauditlogsidget) | **GET** /admin/audit-logs/{id} | 감사 로그 상세 조회|

# **adminAuditLogsGet**
> InternalApiHandlersAPIResponse adminAuditLogsGet()


### Example

```typescript
import {
    AdminAuditLogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminAuditLogsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminAuditLogsGet(
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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminAuditLogsIdGet**
> InternalApiHandlersAPIResponse adminAuditLogsIdGet()


### Example

```typescript
import {
    AdminAuditLogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminAuditLogsApi(configuration);

let id: number; //감사 로그 ID (default to undefined)

const { status, data } = await apiInstance.adminAuditLogsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 감사 로그 ID | defaults to undefined|


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

