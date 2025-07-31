**Structure of the project**  
The project is built of two folders:bullsmediaexcersize and bullsmediaexcersizesecure (same project only with ssl to simulate https).
**Architecture**
- The project is written in Nodejs in order to face large numbers of requests.
- In order to manage large scales of requests I am using pm2 for load balancing with 20 instances maximum (I didn’t use the default configuration “max” in order to limit overload on the computer).
- The server runs on docker in order to prevent “working on my computer” issues.
- The parameters are stored in Postgresql database instance in a table called “originals” that stores the “keyword”,”src” and “creative” plus the method of the special parameter creation and date of creation/update. There is only one record for every parameter set. **The database is indexed** where the key is (“keyword”,”src” ,“creative”) fields.
- All the methods that connect to the database are asynchronized in order to load manage the database.  
I chose to use only one instance of the DB because using more would hurt the integrity of the data, the price of syncing several instances of the DB is unupdated data (like the time of the last change of the set) is too high therefore it is a risk I am willing to take. in order to deal with DB falls I configured the restart in the docker-compose configuration file to ‘always’.
for performance optimization we used PM2 (as I mentioned) instances, minimal SQL queries, SQL indexing,parameterized queries.

**hash method**  
For each unique set of “keyword”,”src” and “creative” there are 6 possible ways to turn them into a generated parameter.  
The special parameter is built in the following way:  
    it is comprised of 3 parts divided by 2 flags:  
      \~\~\~ separates the first and second parts and ~**~ seperates the second and third parts. These flags were chosen because they are not morphed by the URI.
 - **first part** is the method. there are 6 ways to set the order of 3 strings (123,132,213,231,312,321) and that is the system I chose.
 -  **second part** is the length of the first two strings so that I will know how to break the string apart. the lengths are separated by ,.
 -   **third part** is the three parameters one after the other in the order that was set by the method.  
   
 So, for example, the special parameter value “3~\~\~4,3~\*\*~googkeyvery” means that we use method 3 (2,1,3, where 1 is the keyword, 2 is the src and 3 is the creative) on the string “googkeyvery” when the first string is the first 4 characters of the string (goog), the second is the next 3 characters (key) and the remaining characters are “very”, and the parameters are:  
keyword “key”, src:”goog” and creative: “very”.  
\*\*I designed the system so that even after setting a new special parameter, the old one will not be deleted. It is possible that it was the wrong choice, but I preferred to avoid the appearance of a bug and additional SQL queries that would increase the load on the system. Anyway it fits the reverse-map requirement.  
\*the environment variables for the initialization of the project also appear in the .env file. you can change them and set them how you see fit. You can even remove the .env file if you like.    
**routes**
**‘/’ the root route** default route that accepts the 3 parameters (keyword,src,creative)
and return the redirection url with the special param. it also changes the date and time of the update\creation of the last special parameter. (it also creates/updates the record in the database).  
The redirection url is an environment variable that is called CONNECTED_NETWORK
it is defined in the .env file.  
Example:  
http://127.0.0.1:3000/?keyword=painting&src=painter&creative=yes
or  
https://127.0.0.1/?keyword=painting&src=painter&creative=yes  
in the https mode.  
The result is redirection to redirection page with a new special parameter:  
https://127.0.0.1/redirection_page?our_param=1~\~\~8%2C7\~*\*\~paintingpainteryes  
Entering the root page again will lead to changing the our_param:  
https://127.0.0.1/redirection_page?our_param=2~\~\~8%2C3~**~paintingyespainter  
**‘/retrieve_original’** An API endpoint for retrieving parameters from a special parameter. It accepts a string and converts it into a set of parameters.  
Forcing of a new our_param is done by calling the root route again with the same parameters. In this case the current datetime will be saved in the parameters record in the database and another special parameter will be issued, different from the previous special parameter (simply done by another method). We ensure that not the same parameter will be issued because we have the previous method saved in the database.  
In case an illegal/ impossible/wrong special parameter is written in the our_param the route returns an error json.  
Example: entering the retrieve_original for the special parameter we mentioned in the previous example:  
https://127.0.0.1/retrieve_original?our_param=2~\~\~8%2C3~\*\*~paintingyespainter  
would lead to correct parameters:  
{"keyword":"painting","src":"painter","creative":"yes"}  
**‘/find_update_date’** is a route I use to extract information about a record. i.e. the last date of creation/update of the set of parameters. it accepts the keyword, set and creative parameters and returns a message. In case no record was ever created for this specific set of parameters, the route returns a message that tells exactly that to the user.  
**‘/redirection_page’** is a route I made for testing. it simulates the redirection url. it prints out “redirection”and the special parameter (our_param).    
**How to run the project:**  
Open a docker runner you like (preferably Linux based, because I ran it over docker-desktop (on windows)).  
Enter the bullsmediaexcersize folder in powershell and run:
- docker-compose down --volumes --remove-orphans
- docker-compose build --no-cache
- docker-compose up  
  
I used docker-desktop to run my docker so the dockerfile is compatible with Linux
The https version is being run the same way only you enter bullsmediaexcersizesecure  folder and then run the commands.    
  
**Security**  
I didn’t create a login system or a JWT encryption because they are not required here. The description of the assignment stated an API that receives parameters and returns output. The examples included parameters to be passed to a route. not a token or an identifier of any kind, nor a login system. I have a folder with the same project only over https (not secured). In this folder there is the project simulating performing over https and port 443.
Instead of using base_url http://127.0.0.1:3000, in the secure version we use:  
https://127.0.0.1/  
In order to read the logs of the server instances you need to print:  
docker logs -f <container_name_or_id>  
The container_name_or_id can be accessed through writing:  
docker ps  
Then get all the instances and their ids.    
**proof of concept:**  
- Run the docker of the non https project (just for example). wait until the server runs, then open the browser and print:  
http://127.0.0.1:3000/?keyword=monalisa&src=Davinci&creative=yes  
You will get to your redirection_url with special parameter:  
1\~\~\~8%2C7~\*\*~monalisaDavinciyes  
- run the root url again with the original parameters:  
http://127.0.0.1:3000/?keyword=monalisa&src=Davinci&creative=yes  
The root will force a change to the special parameter:  
2\~\~\~8,3~\*\*~monalisayesDavinci  
- now run the retrieve_original route for both special parameters:  
http://127.0.0.1:3000/retrieve_original?our_param=1\~\~\~8%2C7~\*\*~monalisaDavinciyes  
http://127.0.0.1:3000/retrieve_original?our_param=2\~\~\~8,3~\*\*~monalisayesDavinci  
Both of them return the result:  
{"keyword":"monalisa","src":"Davinci","creative":"yes"}  
Now get the last update time of  the parameters  
http://127.0.0.1:3000/find_update_date?keyword=monalisa&src=Davinci&creative=yes  
and get the right date and time:  
parameters set:{keyword:monalisa src:Davinci creative:yes was last reset on Thu Jul 31 2025 15:46:43 GMT+0300 (שעון ישראל (קיץ))  
  
**Tests**  
The project was load tested by **artillery** and got perfect results in very short times.    
  
**Things I would like to add to the project:**  
- Maybe an authentication process is required, using an API call that sends you a token in case of an authentication and allows your requests by the token that sits on the user’s localStorage(maybe?).
- During testing I incorporated artillery testing in the docker-compose to test managing of loads (took it out before sending so that the tests in the background won’t hurt my project’s performance. It's a good idea to add systems of occasional health checks on the servers.
- I would add a Redis instance to take load off the DB (I didn’t use Redis because the performance of the tests was good and I wanted to save time).
- I did implement the enforcement of the new special parameter but I wasn’t sure whether to erase the previous special parameter or not. I chose to keep them both.
Keeping only the new special parameter (according to the method field in the database record) and deleting the previous one is a better idea security wise. I chose to keep both in order to prevent it from looking like a bug (so that users won’t say:”why my special parameter doesn’t work”).
- Another feature can be a system that follows how many times a set of features was called and the special parameter was changed.

























