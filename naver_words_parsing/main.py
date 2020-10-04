import requests
from bs4 import BeautifulSoup as bs

req = requests.get("https://wordbook.daum.net/open/wordbook.do?id=17", verify=False)
soup = bs(req.text, "html.parser")
divs = soup.find_all("div", {"class" : "wrap_word"})

for div in divs:
    spell = (div.find("div", {"class" : "txt_word"}).find("div").find("a").text)
    mean = (div.find("div", {"class" : "mean_info"}))

    if mean.text.strip() != "":
        print(mean.text)
        mean = mean.find("p").find("span").text
        print(mean)

print(len(divs))