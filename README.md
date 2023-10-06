# SoutheastCubing

This project is for the organization website SoutheastCubing.org.
FE: Angular 14.1.3.
Content: Contentful CMS
Deployment: AWS

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Deployment

- Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.
- Compress dist/
- Upload dist.zip file onto AWS S3
- SSH into AWS EC2 instance
- navigate to relevant folder `cd /var/www/html`
- remove current contents `rm -rf *`
- import dist file into EC2 instance `wget {S3 Object URL}` Replace {} with URL from S3 Object
- unzip the compressed folder `unzip dist.zip`
- move files into correct folder `mv dist/jacobambroseme/* .`
- restart server `service httpd restart` or start server `service httpd start`
