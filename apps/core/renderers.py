from rest_framework.renderers import JSONRenderer

class AtulPOSRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = renderer_context.get('response')
        
        # Determine success based on status code
        success = True
        if response and response.status_code >= 400:
            success = False

        # Prepare envelope
        envelope = {
            "success": success,
            "data": data,
            "meta": {}
        }
        
        # Extract meta if present in data (pagination usually)
        if isinstance(data, dict) and 'results' in data:
            envelope['data'] = data['results']
            envelope['meta'] = {
                'count': data.get('count'),
                'next': data.get('next'),
                'previous': data.get('previous')
            }

        return super().render(envelope, accepted_media_type, renderer_context)
