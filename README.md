# SoutheastCubing

This project is for the organization website SoutheastCubing.org.
FE: Angular 14.1.3
BE: NodeJs v16.15.0
Content: Contentful CMS
Deployment: AWS

## FE Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## FE Deployment

- Run `ng build --configuration production` to build the project. The build artifacts will be stored in the `dist/` directory.
- Compress dist/
- Upload dist.zip file onto AWS S3
- Make the dist.zip public using acl
- Copy the URL for dist.zip
- SSH into AWS EC2 instance
- navigate to relevant folder `cd /var/www/html`
- remove current contents `rm -rf *`
- import dist file into EC2 instance `wget {S3 Object URL}` Replace {} with URL from S3 Object
- unzip the compressed folder `unzip dist.zip`
- move files into correct folder `mv dist/southeast-cubing/* .`
- restart server `service httpd restart` or start server `service httpd start`

## BE Development server
Run `node backend/app.js`

## BE Deployment
- cd southeastcubing/backend
- git pull
- npm i
- systemctl restart api.service

## BE Status
- systemctl status api.service
- systemctl status nginx

# FE Fetch a new SSL certificate
- sudo certbot --apache

# BE Fetch a new SSL certificate
- sudo certbot --nginx
